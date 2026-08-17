import React from 'react';
import type { MonthlyPerformanceKPIs } from '../types';
import { MONTH_NAMES } from '../utils/monthly-performance-utils';
import { Card, CardContent } from '@wealthfolio/ui';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Calendar,
  Zap,
  Target,
  Award,
} from 'lucide-react';

interface MonthlyKPIsProps {
  kpis: MonthlyPerformanceKPIs;
  benchmarkName?: string | null;
}

export const MonthlyKPIs: React.FC<MonthlyKPIsProps> = ({ kpis, benchmarkName }) => {
  const formatPercent = (val: number | null) => {
    if (val === null || isNaN(val)) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${(val * 100).toFixed(2)}%`;
  };

  const getMonthLabel = (m: { year: number; month: number } | null) => {
    if (!m) return '—';
    return `${MONTH_NAMES[m.month]} ${m.year}`;
  };

  const isBestMonthPositive = kpis.bestMonth?.value !== null && kpis.bestMonth?.value !== undefined ? kpis.bestMonth.value >= 0 : null;
  const isWorstMonthPositive = kpis.worstMonth?.value !== null && kpis.worstMonth?.value !== undefined ? kpis.worstMonth.value >= 0 : null;
  const isCurrentYearPositive = kpis.currentYearReturn !== null ? kpis.currentYearReturn >= 0 : null;
  const isAlphaPositive = kpis.alphaVsBenchmark !== null ? kpis.alphaVsBenchmark >= 0 : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <style>{`
        .kpi-perf-gain {
          color: #22c55e !important;
        }
        .kpi-perf-loss {
          color: #ef4444 !important;
        }
      `}</style>

      {/* Best Month */}
      <Card className="relative overflow-hidden border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Best Month
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold tracking-tight font-mono ${
                isBestMonthPositive === null
                  ? 'text-muted-foreground'
                  : isBestMonthPositive
                    ? 'kpi-perf-gain'
                    : 'kpi-perf-loss'
              }`}
            >
              {formatPercent(kpis.bestMonth?.value ?? null)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 opacity-70" />
              <span>{getMonthLabel(kpis.bestMonth)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worst Month */}
      <Card className="relative overflow-hidden border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Worst Month
            </span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 dark:bg-rose-500/20">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold tracking-tight font-mono ${
                isWorstMonthPositive === null
                  ? 'text-muted-foreground'
                  : isWorstMonthPositive
                    ? 'kpi-perf-gain'
                    : 'kpi-perf-loss'
              }`}
            >
              {formatPercent(kpis.worstMonth?.value ?? null)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 opacity-70" />
              <span>{getMonthLabel(kpis.worstMonth)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positive Months (Win Rate) */}
      <Card className="relative overflow-hidden border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Positive Months
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:bg-blue-500/20">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {kpis.positiveRatio !== null ? `${kpis.positiveRatio.toFixed(1)}%` : '—'}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Target className="w-3.5 h-3.5 opacity-70" />
              <span>
                {kpis.positiveMonthsCount} / {kpis.totalMonthsCount} months
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Year Return or Alpha */}
      <Card className="relative overflow-hidden border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {benchmarkName ? 'Alpha vs Benchmark' : 'Current Year Return'}
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
              {benchmarkName ? <Award className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            {benchmarkName ? (
              <>
                <div
                  className={`text-2xl font-bold tracking-tight font-mono ${
                    isAlphaPositive === null
                      ? 'text-muted-foreground'
                      : isAlphaPositive
                        ? 'kpi-perf-gain'
                        : 'kpi-perf-loss'
                  }`}
                >
                  {formatPercent(kpis.alphaVsBenchmark)}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span>vs {benchmarkName}</span>
                </div>
              </>
            ) : (
              <>
                <div
                  className={`text-2xl font-bold tracking-tight font-mono ${
                    isCurrentYearPositive === null
                      ? 'text-muted-foreground'
                      : isCurrentYearPositive
                        ? 'kpi-perf-gain'
                        : 'kpi-perf-loss'
                  }`}
                >
                  {formatPercent(kpis.currentYearReturn)}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span>YTD ({new Date().getFullYear()})</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
