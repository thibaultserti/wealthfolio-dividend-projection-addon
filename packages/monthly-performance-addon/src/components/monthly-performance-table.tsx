import React from 'react';
import type { YearComparisonData, MonthlyViewMode } from '../types';
import { MONTH_NAMES } from '../utils/monthly-performance-utils';

export interface MonthlyPerformanceTableProps {
  data: YearComparisonData[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  viewMode: MonthlyViewMode;
  hasBenchmark?: boolean;
}

export const MonthlyPerformanceTable: React.FC<MonthlyPerformanceTableProps> = ({
  data,
  selectedYear,
  onSelectYear,
  viewMode,
  hasBenchmark,
}) => {
  if (!data.length) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No monthly performance data available for this selection.
      </div>
    );
  }

  const formatPercent = (val: number | null) => {
    if (val === null || isNaN(val)) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${(val * 100).toFixed(2)}%`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <style>{`
        .monthly-perf-gain {
          color: #22c55e !important;
        }
        .monthly-perf-loss {
          color: #ef4444 !important;
        }
        .monthly-perf-muted {
          color: #6b7280 !important;
          opacity: 0.5 !important;
        }
      `}</style>
      <table className="w-full min-w-[760px] border-collapse font-mono text-xs table-fixed">
        {/* Table Header */}
        <thead>
          <tr className="text-muted-foreground/70 border-b border-border/40 text-[11px]">
            <th className="w-16 py-2.5 px-3 text-left font-semibold">Year</th>
            {MONTH_NAMES.map((m) => (
              <th key={m} className="py-2.5 px-1 text-center font-semibold">
                {m}
              </th>
            ))}
            <th className="w-24 py-2.5 px-3 text-right font-semibold">Total</th>
          </tr>
        </thead>

        {/* Year Rows */}
        <tbody className="space-y-1">
          {data.map((row) => {
            const isSelected = row.year === selectedYear;

            // Compute year total return based on viewMode
            let yearTotalValue: number | null = null;
            if (viewMode === 'benchmark') {
              yearTotalValue = row.benchmarkYearTotal;
            } else if (viewMode === 'relative') {
              yearTotalValue = row.relativeYearTotal;
            } else {
              yearTotalValue = row.portfolioYearTotal;
            }

            // Determine if year total is positive / outperforming benchmark
            let isYearPositive: boolean | null = null;
            if (yearTotalValue !== null) {
              if (viewMode === 'portfolio' && hasBenchmark && row.relativeYearTotal !== null) {
                isYearPositive = row.relativeYearTotal >= 0;
              } else if (viewMode === 'relative') {
                isYearPositive = row.relativeYearTotal !== null ? row.relativeYearTotal >= 0 : null;
              } else {
                isYearPositive = yearTotalValue >= 0;
              }
            }

            return (
              <tr
                key={row.year}
                onClick={() => onSelectYear(row.year)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-primary/15 dark:bg-emerald-950/40'
                    : 'hover:bg-muted/50'
                }`}
              >
                {/* Year Cell */}
                <td
                  className={`py-2.5 px-3 text-left font-bold rounded-l-lg ${
                    isSelected ? 'text-primary font-extrabold' : 'text-foreground'
                  }`}
                >
                  {row.year}
                </td>

                {/* 12 Month Cells */}
                {row.months.map((cell, monthIdx) => {
                  if (!cell) {
                    return (
                      <td key={monthIdx} className="py-2.5 px-1 text-center">
                        <span className="monthly-perf-muted">—</span>
                      </td>
                    );
                  }

                  let val: number | null = null;
                  if (viewMode === 'benchmark') {
                    val = cell.benchmarkReturn;
                  } else if (viewMode === 'relative') {
                    val = cell.relativeReturn;
                  } else {
                    val = cell.portfolioReturn;
                  }

                  if (val === null) {
                    return (
                      <td key={monthIdx} className="py-2.5 px-1 text-center">
                        <span className="monthly-perf-muted">—</span>
                      </td>
                    );
                  }

                  // If benchmark is selected, green means outperforming benchmark (relativeReturn >= 0), red means underperforming
                  let isPositive: boolean;
                  if (viewMode === 'portfolio' && hasBenchmark && cell.relativeReturn !== null) {
                    isPositive = cell.relativeReturn >= 0;
                  } else if (viewMode === 'relative') {
                    isPositive = val >= 0;
                  } else {
                    isPositive = val >= 0;
                  }

                  return (
                    <td
                      key={monthIdx}
                      className="py-2.5 px-1 text-center text-[11px] font-semibold tracking-tight"
                      title={
                        hasBenchmark && cell.relativeReturn !== null
                          ? `Portfolio: ${formatPercent(cell.portfolioReturn)} | Benchmark: ${formatPercent(
                              cell.benchmarkReturn,
                            )} | Alpha: ${formatPercent(cell.relativeReturn)}`
                          : cell.portfolioReturn !== null
                            ? `Portfolio: ${formatPercent(cell.portfolioReturn)}`
                            : undefined
                      }
                    >
                      <span className={isPositive ? 'monthly-perf-gain font-semibold' : 'monthly-perf-loss font-semibold'}>
                        {formatPercent(val)}
                      </span>
                    </td>
                  );
                })}

                {/* Year Total / YTD */}
                <td className="py-2.5 px-3 text-right text-[11px] font-bold rounded-r-lg">
                  {yearTotalValue !== null ? (
                    <span
                      className={
                        isYearPositive === null
                          ? 'text-muted-foreground font-bold'
                          : isYearPositive
                            ? 'monthly-perf-gain font-bold'
                            : 'monthly-perf-loss font-bold'
                      }
                    >
                      {formatPercent(yearTotalValue)}
                    </span>
                  ) : (
                    <span className="monthly-perf-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
