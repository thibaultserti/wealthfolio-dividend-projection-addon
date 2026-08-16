import { useQuery } from '@tanstack/react-query';
import type { HostAPI, Account, Holding, Asset } from '@wealthfolio/addon-sdk';
import type { AccountScope, PortfolioAggregatedMetrics, RawStockFinancials } from '../types';
import {
  aggregatePortfolioMetrics,
  isCashHolding,
  isEtfOrFund,
  resolveCandidateTickers,
} from '../services/metrics-engine';
import { fetchStockFundamentals } from '../services/financial-data-service';

export function usePortfolioMetrics({
  api,
  scope,
}: {
  api: HostAPI;
  scope: AccountScope;
}) {
  return useQuery<PortfolioAggregatedMetrics, Error>({
    queryKey: ['portfolio-metrics-data', scope],
    queryFn: async () => {
      // 1. Fetch Accounts & Settings
      const [accounts, settings] = await Promise.all([
        api.accounts.getAll().catch(() => [] as Account[]),
        api.settings.get().catch(() => ({ baseCurrency: 'USD' })),
      ]);

      const baseCurrency = settings.baseCurrency || 'USD';

      // 2. Filter target accounts based on scope
      let targetAccounts: Account[] = [];
      if (scope.type === 'all') {
        targetAccounts = accounts.filter((a) => !a.isArchived);
      } else if (scope.type === 'group') {
        targetAccounts = accounts.filter((a) => !a.isArchived && a.group === scope.id);
      } else if (scope.type === 'account' && scope.id) {
        targetAccounts = accounts.filter((a) => a.id === scope.id);
      } else {
        targetAccounts = accounts.filter((a) => !a.isArchived);
      }

      // 3. Fetch holdings
      const holdingsPromises = targetAccounts.map(async (acc) => {
        try {
          return await api.portfolio.getHoldings(acc.id);
        } catch {
          return [] as Holding[];
        }
      });

      const holdingsArrays = await Promise.all(holdingsPromises);
      const rawHoldings = holdingsArrays.flat();

      // Aggregate identical assets across accounts
      const mergedHoldingsMap = new Map<string, Holding>();
      for (const h of rawHoldings) {
        const key = h.instrument?.symbol || h.instrument?.id || h.id;
        const existing = mergedHoldingsMap.get(key);
        if (existing) {
          existing.quantity = (Number(existing.quantity) || 0) + (Number(h.quantity) || 0);
          if (existing.marketValue && h.marketValue) {
            existing.marketValue.local = (Number(existing.marketValue.local) || 0) + (Number(h.marketValue.local) || 0);
            existing.marketValue.base = (Number(existing.marketValue.base) || 0) + (Number(h.marketValue.base) || 0);
          }
          if (existing.costBasis && h.costBasis) {
            existing.costBasis.local = (Number(existing.costBasis.local) || 0) + (Number(h.costBasis.local) || 0);
            existing.costBasis.base = (Number(existing.costBasis.base) || 0) + (Number(h.costBasis.base) || 0);
          }
        } else {
          mergedHoldingsMap.set(key, {
            ...h,
            marketValue: {
              local: Number(h.marketValue?.local) || 0,
              base: Number(h.marketValue?.base) || 0,
            },
            costBasis: {
              local: Number(h.costBasis?.local) || 0,
              base: Number(h.costBasis?.base) || 0,
            },
          });
        }
      }

      const mergedHoldings = Array.from(mergedHoldingsMap.values()).filter(
        (h) => (Number(h.quantity) || 0) > 0 && !isCashHolding(h),
      );

      // 4. Fetch asset profiles for accurate metadata
      const assetProfilesById: Record<string, Asset> = {};
      await Promise.all(
        mergedHoldings.map(async (h) => {
          const assetId = h.instrument?.id;
          if (assetId && !assetId.startsWith('cash:')) {
            try {
              const profile = await api.assets.getProfile(assetId);
              if (profile) {
                assetProfilesById[assetId] = profile;
              }
            } catch {
              // Ignore failure
            }
          }
        }),
      );

      // 5. Build candidate tickers for stocks
      const candidates: { symbol: string; primaryTicker: string; fallbackTickers: string[] }[] = [];
      for (const h of mergedHoldings) {
        const rawSymbol = h.instrument?.symbol;
        if (!rawSymbol) continue;
        const profile = h.instrument?.id ? assetProfilesById[h.instrument.id] : undefined;
        if (isEtfOrFund(h, profile)) continue;

        const resolved = resolveCandidateTickers(
          rawSymbol,
          profile?.instrumentExchangeMic || undefined,
          profile?.quoteCcy || h.localCurrency,
        );

        candidates.push({
          symbol: rawSymbol,
          primaryTicker: resolved.primaryTicker,
          fallbackTickers: resolved.fallbackTickers,
        });
      }

      // 6. Fetch fundamentals from imported CSV storage
      let financialsBySymbol: Record<string, RawStockFinancials> = {};
      let importedCount = 0;
      let lastImportedAt: number | null = null;

      try {
        const resp = await fetchStockFundamentals({
          symbols: candidates,
          api,
        });
        financialsBySymbol = resp.financialsBySymbol;
        importedCount = resp.importedCount;
        lastImportedAt = resp.lastImportedAt;
      } catch {
        financialsBySymbol = {};
      }

      // 7. Compute aggregate metrics
      const aggregated = aggregatePortfolioMetrics({
        holdings: mergedHoldings,
        financialsBySymbol,
        assetProfilesById,
        scope,
        baseCurrency,
      });

      const portfolioTickers = candidates.map((c) => c.primaryTicker);

      return {
        ...aggregated,
        importedCount,
        lastImportedAt,
        portfolioTickers,
      } as PortfolioAggregatedMetrics & {
        importedCount: number;
        lastImportedAt: number | null;
        portfolioTickers: string[];
      };
    },
    staleTime: 300_000,
  });
}
