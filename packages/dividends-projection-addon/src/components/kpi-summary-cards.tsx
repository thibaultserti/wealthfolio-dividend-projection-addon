import React from 'react';
import type { DividendsSummary } from '../types';
import { Card, CardContent } from '@wealthfolio/ui';
import { Coins, Percent, TrendingUp, LineChart, Calendar, Sparkles } from 'lucide-react';

interface KPISummaryCardsProps {
  summary: DividendsSummary;
}

export const KPISummaryCards: React.FC<KPISummaryCardsProps> = ({ summary }) => {
  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: summary.baseCurrency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const percentFormatter = (val: number | null) => {
    if (val === null || isNaN(val)) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Projected Annual Income */}
      <Card className="relative overflow-hidden border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projected Annual Income
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {currencyFormatter.format(summary.projectedAnnualIncome)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 opacity-70" />
              <span>~{currencyFormatter.format(summary.projectedMonthlyAverage)} / month</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dividend Yield */}
      <Card className="relative overflow-hidden border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dividend Yield
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:bg-blue-500/20">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {summary.dividendYieldPct.toFixed(2)}%
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 opacity-80" />
              <span>
                {summary.payingHoldingsCount} of {summary.totalHoldingsCount} assets pay dividends
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yield on Cost (YoC) */}
      <Card className="relative overflow-hidden border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Yield on Cost (YoC)
            </span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20">
              <LineChart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {summary.yieldOnCostPct.toFixed(2)}%
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              {summary.yieldOnCostPct >= summary.dividendYieldPct ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  +{(summary.yieldOnCostPct - summary.dividendYieldPct).toFixed(2)}% vs Current
                  Yield
                </span>
              ) : (
                <span>Based on total cost basis</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dividend Growth (12M & 5Y CAGR) */}
      <Card className="relative overflow-hidden border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dividend Growth
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 dark:bg-purple-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {percentFormatter(summary.growth12MPct)}
              </span>
              <span className="text-xs text-muted-foreground font-normal">Last 12M</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>5Y CAGR:</span>
              <span
                className={`font-semibold ${summary.growth5YPct && summary.growth5YPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
              >
                {percentFormatter(summary.growth5YPct)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
