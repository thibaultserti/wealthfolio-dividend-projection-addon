import { useQuery } from '@tanstack/react-query';
import type { HostAPI, ReturnData, PerformanceResult, Account } from '@wealthfolio/addon-sdk';
import type { PortfolioScope, YearComparisonData, MonthlyPerformanceKPIs } from '../types';
import {
  calculateMonthlyReturns,
  buildMonthlyComparison,
  calculatePerformanceKPIs,
} from '../utils/monthly-performance-utils';

interface UseMonthlyPerformanceOptions {
  api: HostAPI;
  scope: PortfolioScope;
  benchmarkSymbol?: string | null;
}

export interface MonthlyPerformanceQueryResult {
  portfolioSeries: ReturnData[];
  benchmarkSeries: ReturnData[];
  comparisonData: YearComparisonData[];
  kpis: MonthlyPerformanceKPIs;
  portfolioName: string;
  benchmarkName: string | null;
  baseCurrency: string;
}

export function useMonthlyPerformance({
  api,
  scope,
  benchmarkSymbol,
}: UseMonthlyPerformanceOptions) {
  // Query 1: Fetch user settings
  const settingsQuery = useQuery({
    queryKey: ['addon-settings'],
    queryFn: async () => {
      try {
        return await api.settings.get();
      } catch {
        return null;
      }
    },
    staleTime: 300_000,
  });

  // Query 2: Fetch portfolio performance history
  const portfolioHistoryQuery = useQuery({
    queryKey: ['monthly-performance-portfolio', scope.type, scope.id],
    queryFn: async (): Promise<PerformanceResult | null> => {
      try {
        // Case 1: Specific Account selected
        if (scope.type === 'account' && scope.id) {
          return await api.performance.calculateHistory('account', scope.id);
        }

        // Case 2: All Portfolios or Specific Portfolio (Group) selected
        let accounts: Account[] = [];
        try {
          accounts = await api.accounts.getAll();
        } catch (err) {
          console.warn('Failed to fetch accounts list:', err);
        }

        const activeAccounts = accounts.filter((a) => !a.isArchived);
        const scopedAccounts =
          (scope.type === 'portfolio' || scope.type === 'group') && scope.id
            ? activeAccounts.filter((a) => a.group === scope.id)
            : activeAccounts;

        if (scopedAccounts.length === 0) {
          return null;
        }

        // If exactly 1 account in scope, fetch that account's history directly
        if (scopedAccounts.length === 1) {
          return await api.performance.calculateHistory('account', scopedAccounts[0].id);
        }

        // If 'all' scope, try portfolio:all first
        if (scope.type === 'all') {
          try {
            const res = await api.performance.calculateHistory('account', 'portfolio:all');
            if (res && res.series && res.series.length >= 2) {
              return res;
            }
          } catch {
            // ignore fallback
          }
        }

        // Fetch performance for each scoped account in parallel
        const results = await Promise.allSettled(
          scopedAccounts.map((a) => api.performance.calculateHistory('account', a.id)),
        );

        const validResults = results
          .filter(
            (r): r is PromiseFulfilledResult<PerformanceResult> =>
              r.status === 'fulfilled' && Boolean(r.value?.series && r.value.series.length >= 2),
          )
          .map((r) => r.value);

        if (validResults.length === 0) {
          return null;
        }

        if (validResults.length === 1) {
          return validResults[0];
        }

        // Merge multiple account return series by date (combining points)
        const dateMap = new Map<string, number[]>();
        for (const res of validResults) {
          for (const pt of res.series) {
            const list = dateMap.get(pt.date) ?? [];
            list.push(pt.value);
            dateMap.set(pt.date, list);
          }
        }

        const sortedDates = Array.from(dateMap.keys()).sort();
        const mergedSeries: ReturnData[] = sortedDates.map((date) => {
          const vals = dateMap.get(date)!;
          const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length;
          return { date, value: avg };
        });

        return {
          ...validResults[0],
          series: mergedSeries,
        };
      } catch (err) {
        console.error('Failed to fetch portfolio performance history:', err);
        return null;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Query 3: Fetch benchmark performance history (if symbol provided)
  const benchmarkHistoryQuery = useQuery({
    queryKey: ['monthly-performance-benchmark', benchmarkSymbol],
    queryFn: async (): Promise<PerformanceResult | null> => {
      if (!benchmarkSymbol || !benchmarkSymbol.trim()) return null;
      try {
        return await api.performance.calculateHistory('symbol', benchmarkSymbol.trim());
      } catch (err) {
        console.warn(`Failed to fetch benchmark history for ${benchmarkSymbol}:`, err);
        return null;
      }
    },
    enabled: Boolean(benchmarkSymbol && benchmarkSymbol.trim()),
    staleTime: 300_000,
    retry: 1,
  });

  const isLoading =
    portfolioHistoryQuery.isLoading || (Boolean(benchmarkSymbol) && benchmarkHistoryQuery.isLoading);
  const isFetching = portfolioHistoryQuery.isFetching || benchmarkHistoryQuery.isFetching;
  const error = portfolioHistoryQuery.error || benchmarkHistoryQuery.error;

  const portfolioSeries = portfolioHistoryQuery.data?.series ?? [];
  const benchmarkSeries = benchmarkHistoryQuery.data?.series ?? [];

  // Compute monthly matrix and comparison
  const portfolioMonthly = calculateMonthlyReturns(portfolioSeries);
  const benchmarkMonthly =
    benchmarkSeries.length > 0 ? calculateMonthlyReturns(benchmarkSeries) : undefined;
  const comparisonData = buildMonthlyComparison(portfolioMonthly, benchmarkMonthly);
  const kpis = calculatePerformanceKPIs(comparisonData, portfolioSeries);

  const portfolioName =
    scope.type === 'account' && scope.label
      ? scope.label
      : (scope.type === 'portfolio' || scope.type === 'group') && scope.label
      ? `Portfolio: ${scope.label}`
      : 'All Portfolios';
  const benchmarkName = benchmarkSymbol ? benchmarkSymbol : null;
  const baseCurrency = (settingsQuery.data as any)?.baseCurrency || 'USD';

  const refetch = async () => {
    await Promise.all([
      portfolioHistoryQuery.refetch(),
      benchmarkSymbol ? benchmarkHistoryQuery.refetch() : Promise.resolve(),
    ]);
  };

  return {
    data: {
      portfolioSeries,
      benchmarkSeries,
      comparisonData,
      kpis,
      portfolioName,
      benchmarkName,
      baseCurrency,
    },
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
