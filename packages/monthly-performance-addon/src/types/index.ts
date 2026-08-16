import type { ReturnData } from '@wealthfolio/addon-sdk';

export interface MonthlyReturnCell {
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  value: number; // Decimal (e.g. 0.05 for 5%)
}

export interface YearPerformanceData {
  year: number;
  months: (number | null)[]; // Array of length 12 (Jan = index 0 .. Dec = index 11), null if no data
  yearTotal: number | null; // Compounded annual return (or YTD)
}

export interface MonthlyComparisonCell {
  month: number;
  portfolioReturn: number | null;
  benchmarkReturn: number | null;
  relativeReturn: number | null; // portfolioReturn - benchmarkReturn
}

export interface YearComparisonData {
  year: number;
  months: (MonthlyComparisonCell | null)[]; // 12 elements
  portfolioYearTotal: number | null;
  benchmarkYearTotal: number | null;
  relativeYearTotal: number | null;
}

export type MonthlyViewMode = 'portfolio' | 'benchmark' | 'relative';

export interface AccountScope {
  type: 'all' | 'account' | 'group';
  id?: string;
  label?: string;
}

export interface BenchmarkPreset {
  id: string;
  name: string;
  symbol: string;
  category?: string;
}

export interface MonthlyPerformanceKPIs {
  bestMonth: { year: number; month: number; value: number } | null;
  worstMonth: { year: number; month: number; value: number } | null;
  positiveMonthsCount: number;
  totalMonthsCount: number;
  positiveRatio: number | null;
  currentYearReturn: number | null;
  totalCumulativeReturn: number | null;
  annualizedReturn: number | null;
  alphaVsBenchmark: number | null;
}
