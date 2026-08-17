import React, { useState, useEffect, useMemo } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';
import type { PortfolioScope, MonthlyViewMode } from '../types';
import { useMonthlyPerformance } from '../hooks/use-monthly-performance';
import { calculatePerformanceKPIs } from '../utils/monthly-performance-utils';
import { PortfolioScopeFilter } from './portfolio-scope-filter';
import { BenchmarkSelector } from './benchmark-selector';
import { MonthlyKPIs } from './monthly-kpis';
import { MonthlyPerformanceChart } from './monthly-performance-chart';
import { MonthlyPerformanceTable } from './monthly-performance-table';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  DateRangeSelector,
  type DateRange,
} from '@wealthfolio/ui';
import {
  Calendar,
  RefreshCw,
  TrendingUp,
  HelpCircle,
  BarChart3,
  Layers,
  Sparkles,
} from 'lucide-react';

interface MonthlyPerformanceDashboardProps {
  api: HostAPI;
}

export const MonthlyPerformanceDashboard: React.FC<MonthlyPerformanceDashboardProps> = ({
  api,
}) => {
  const [scope, setScope] = useState<PortfolioScope>({
    type: 'all',
    label: 'All Portfolios',
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MonthlyViewMode>('portfolio');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data, isLoading, isFetching, refetch } = useMonthlyPerformance({
    api,
    scope,
    benchmarkSymbol,
  });

  const { portfolioSeries, benchmarkSeries, comparisonData, portfolioName, benchmarkName } = data;

  // Filter comparison data by dateRange (by years included in the range)
  const filteredComparisonData = useMemo(() => {
    if (!comparisonData.length) return [];
    const startYear = dateRange?.from ? dateRange.from.getFullYear() : undefined;
    const endYear = dateRange?.to ? dateRange.to.getFullYear() : undefined;

    const filtered = comparisonData.filter((row) => {
      if (startYear !== undefined && row.year < startYear) return false;
      if (endYear !== undefined && row.year > endYear) return false;
      return true;
    });

    return filtered.length > 0 ? filtered : comparisonData;
  }, [comparisonData, dateRange]);

  // Compute KPIs according to the filtered period
  const kpis = useMemo(() => {
    return calculatePerformanceKPIs(filteredComparisonData, portfolioSeries);
  }, [filteredComparisonData, portfolioSeries]);

  const hasBenchmark = Boolean(benchmarkSymbol && benchmarkSeries.length > 0);

  // If benchmark is removed and viewMode was benchmark/relative, reset to portfolio
  useEffect(() => {
    if (!hasBenchmark && (viewMode === 'benchmark' || viewMode === 'relative')) {
      setViewMode('portfolio');
    }
  }, [hasBenchmark, viewMode]);

  // Set default selected year to latest available year in filtered comparison data
  useEffect(() => {
    if (filteredComparisonData.length > 0) {
      if (selectedYear === null || !filteredComparisonData.some((d) => d.year === selectedYear)) {
        setSelectedYear(filteredComparisonData[0].year);
      }
    }
  }, [filteredComparisonData, selectedYear]);

  const activeYearData = useMemo(() => {
    if (!filteredComparisonData.length || selectedYear === null) return null;
    return filteredComparisonData.find((d) => d.year === selectedYear) ?? filteredComparisonData[0];
  }, [filteredComparisonData, selectedYear]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Monthly Performance
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Monthly breakdown of investment returns, annual compounding, and benchmark comparison
            (Alpha).
          </p>
        </div>

        {/* Action Controls: Date Range Selector, Scope Filter, Benchmark Picker, Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <DateRangeSelector value={dateRange} onChange={setDateRange} hiddenRanges={['1D']} />
          <PortfolioScopeFilter api={api} scope={scope} onScopeChange={setScope} />
          <BenchmarkSelector
            api={api}
            benchmarkSymbol={benchmarkSymbol}
            onBenchmarkChange={setBenchmarkSymbol}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-9 w-9 cursor-pointer"
            title="Refresh Performance Data"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-6">
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
          <Card className="h-96">
            <CardContent className="p-6">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && comparisonData.length === 0 && (
        <Card className="border-border/60 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Performance History Found</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Add transactions or portfolio activities to your accounts in Wealthfolio to generate
            monthly return matrices and charts.
          </p>
        </Card>
      )}

      {/* Populated Dashboard Content */}
      {!isLoading && filteredComparisonData.length > 0 && activeYearData && (
        <>
          {/* Summary KPIs */}
          <MonthlyKPIs kpis={kpis} benchmarkName={benchmarkName} />

          {/* Main Matrix and Chart Card */}
          <Card className="overflow-hidden border-border/60 shadow-xs bg-card/70 backdrop-blur-xs">
            <CardHeader className="flex flex-col gap-3 pb-2 pt-5 sm:flex-row sm:items-center sm:justify-between border-b border-border/40">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">
                  {selectedYear} Return Breakdown
                </CardTitle>
                <div className="text-xs text-muted-foreground font-mono bg-muted/40 px-2 py-0.5 rounded-md">
                  {filteredComparisonData.length}{' '}
                  {filteredComparisonData.length === 1 ? 'Year' : 'Years'} Total
                </div>
              </div>

              {/* View Mode Toggle when Benchmark is present */}
              {hasBenchmark && (
                <div className="bg-muted/40 inline-flex items-center rounded-lg p-1 text-xs border border-border/40">
                  <Button
                    variant={viewMode === 'portfolio' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`h-7 rounded-md px-2.5 text-xs font-medium ${
                      viewMode === 'portfolio' ? 'bg-background text-foreground shadow-xs' : ''
                    }`}
                    onClick={() => setViewMode('portfolio')}
                  >
                    {portfolioName}
                  </Button>
                  <Button
                    variant={viewMode === 'benchmark' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`h-7 rounded-md px-2.5 text-xs font-medium ${
                      viewMode === 'benchmark' ? 'bg-background text-foreground shadow-xs' : ''
                    }`}
                    onClick={() => setViewMode('benchmark')}
                  >
                    {benchmarkName}
                  </Button>
                  <Button
                    variant={viewMode === 'relative' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`h-7 rounded-md px-2.5 text-xs font-medium ${
                      viewMode === 'relative' ? 'bg-background text-foreground shadow-xs' : ''
                    }`}
                    onClick={() => setViewMode('relative')}
                  >
                    Alpha (Excess)
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              {/* Top Monthly Bar Chart for Selected Year */}
              <MonthlyPerformanceChart
                year={activeYearData.year}
                months={activeYearData.months}
                viewMode={viewMode}
                portfolioName={portfolioName}
                benchmarkName={benchmarkName}
              />

              {/* Bottom Multi-Year Table Matrix */}
              <div className="border-t border-border/40 pt-4">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Multi-Year Return Matrix
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Click any year row to view monthly distribution chart
                  </span>
                </div>
                <MonthlyPerformanceTable
                  data={filteredComparisonData}
                  selectedYear={activeYearData.year}
                  onSelectYear={setSelectedYear}
                  viewMode={viewMode}
                  hasBenchmark={hasBenchmark}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
