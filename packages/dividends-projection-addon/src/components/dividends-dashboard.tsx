import React, { useState, useEffect } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';
import type { AccountScope } from '../types';
import { useDividendData } from '../hooks/use-dividend-data';
import { AccountScopeFilter } from './account-scope-filter';
import { KPISummaryCards } from './kpi-summary-cards';
import { MonthlyProjectionChart } from './monthly-projection-chart';
import { MonthDetailView } from './month-detail-view';
import { HoldingsDividendTable } from './holdings-dividend-table';
import { Button, Card, CardContent, Skeleton } from '@wealthfolio/ui';
import { RefreshCw, Coins, AlertCircle, Layers } from 'lucide-react';

interface DividendsDashboardProps {
  api: HostAPI;
}

export const DividendsDashboard: React.FC<DividendsDashboardProps> = ({ api }) => {
  const [scope, setScope] = useState<AccountScope>({ type: 'all', label: 'All Accounts' });
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const { data: summary, isLoading, error, refetch, isRefetching } = useDividendData({
    api,
    scope,
  });

  // Set default selected month to first projected month once data is loaded
  useEffect(() => {
    if (summary && summary.monthlyProjections.length > 0 && !selectedMonthKey) {
      // Pick current month or the first month that has a non-zero payout if possible
      const monthWithPayout = summary.monthlyProjections.find((m) => m.totalAmountBase > 0);
      setSelectedMonthKey(monthWithPayout ? monthWithPayout.key : summary.monthlyProjections[0].key);
    }
  }, [summary, selectedMonthKey]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-xs">
              <Coins className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Dividends Projection
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Forecast future dividend distributions, analyze yields, yield on cost, and track dividend growth.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <AccountScopeFilter api={api} scope={scope} onScopeChange={setScope} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="h-9 w-9 cursor-pointer"
            title="Refresh Dividend Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-28">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-36" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-5">
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sm">Failed to load dividend data</span>
              <span className="text-xs text-muted-foreground">{error.message}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="ml-auto text-xs"
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Success View */}
      {summary && !isLoading && (
        <>
          {summary.totalHoldingsCount === 0 ? (
            <Card className="py-12 text-center border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3">
                <div className="p-3 rounded-full bg-muted">
                  <Layers className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="text-base font-semibold text-foreground">No Holdings Found</div>
                <div className="text-xs text-muted-foreground max-w-sm">
                  There are no assets or holdings in the selected scope ({scope.label || 'Selected Scope'}). Add holdings or select another portfolio to view dividend projections.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Top Summary Cards */}
              <KPISummaryCards summary={summary} />

              {/* Middle Section: 12-Month Chart + Month Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7">
                  <MonthlyProjectionChart
                    projections={summary.monthlyProjections}
                    baseCurrency={summary.baseCurrency}
                    monthlyAverage={summary.projectedMonthlyAverage}
                    selectedMonthKey={selectedMonthKey}
                    onSelectMonth={(key) => setSelectedMonthKey(key)}
                  />
                </div>

                <div className="lg:col-span-5">
                  <MonthDetailView
                    projections={summary.monthlyProjections}
                    selectedMonthKey={selectedMonthKey || summary.monthlyProjections[0]?.key}
                    baseCurrency={summary.baseCurrency}
                    onSelectMonth={(key) => setSelectedMonthKey(key)}
                  />
                </div>
              </div>

              {/* Bottom Section: Holdings Dividend Table */}
              <HoldingsDividendTable
                holdings={summary.holdings}
                baseCurrency={summary.baseCurrency}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
