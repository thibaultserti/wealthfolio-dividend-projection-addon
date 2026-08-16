import type { ReturnData } from '@wealthfolio/addon-sdk';
import type {
  YearPerformanceData,
  YearComparisonData,
  MonthlyComparisonCell,
  MonthlyPerformanceKPIs,
} from '../types';

const ONE = 1;

/**
 * Parses "YYYY-MM-DD" into { year, monthIndex (0..11), day }
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-based
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return { year, month, day };
}

/**
 * Calculates monthly returns for every year/month present in a cumulative return series.
 * Series should be sorted by date ascending.
 *
 * For each month:
 * Return = (1 + R_end_of_month) / (1 + R_end_of_previous_month) - 1
 */
export function calculateMonthlyReturns(series: ReturnData[]): YearPerformanceData[] {
  if (!series || series.length < 2) {
    return [];
  }

  // Sort series by date ascending
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));

  // Map of "YYYY-MM" to the list of ReturnData points in that month
  const pointsByMonth = new Map<string, ReturnData[]>();

  for (const point of sorted) {
    const parts = parseDateParts(point.date);
    if (!parts) continue;
    const monthKey = `${parts.year}-${String(parts.month + 1).padStart(2, '0')}`;
    const list = pointsByMonth.get(monthKey) ?? [];
    list.push(point);
    pointsByMonth.set(monthKey, list);
  }

  const sortedMonthKeys = Array.from(pointsByMonth.keys()).sort();
  if (sortedMonthKeys.length === 0) return [];

  // Map of monthKey -> monthly return (number)
  const monthlyReturnMap = new Map<string, number>();

  // Map of monthKey -> last cumulative value
  const lastCumulativeByMonth = new Map<string, number>();
  for (const [key, pts] of pointsByMonth.entries()) {
    lastCumulativeByMonth.set(key, pts[pts.length - 1].value);
  }

  // To compute the return for the first month in history:
  // we look at the first point in that month.
  for (let i = 0; i < sortedMonthKeys.length; i++) {
    const monthKey = sortedMonthKeys[i];
    const pts = pointsByMonth.get(monthKey)!;
    const endPoint = pts[pts.length - 1];

    let baseFactor: number;

    if (i === 0) {
      // First month: base is the first point in this month
      const startPoint = pts[0];
      baseFactor = ONE + Number(startPoint.value);
    } else {
      // Base is the last point of the previous available month
      const prevMonthKey = sortedMonthKeys[i - 1];
      const prevVal = lastCumulativeByMonth.get(prevMonthKey)!;
      baseFactor = ONE + Number(prevVal);
    }

    const endFactor = ONE + Number(endPoint.value);

    if (baseFactor !== 0 && Number.isFinite(baseFactor) && Number.isFinite(endFactor)) {
      const monthReturn = endFactor / baseFactor - ONE;
      monthlyReturnMap.set(monthKey, monthReturn);
    }
  }

  // Group months by year
  const yearsMap = new Map<number, (number | null)[]>();

  for (const [monthKey, ret] of monthlyReturnMap.entries()) {
    const [yStr, mStr] = monthKey.split('-');
    const year = parseInt(yStr, 10);
    const monthIdx = parseInt(mStr, 10) - 1;

    if (!yearsMap.has(year)) {
      yearsMap.set(year, Array(12).fill(null));
    }
    yearsMap.get(year)![monthIdx] = ret;
  }

  const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => b - a); // Descending years

  return sortedYears.map((year) => {
    const months = yearsMap.get(year)!;
    // Compounded year total: product of (1 + r_m) - 1 for all non-null months
    let compoundFactor = ONE;
    let hasAnyMonth = false;

    for (const mRet of months) {
      if (mRet !== null && Number.isFinite(mRet)) {
        compoundFactor *= ONE + mRet;
        hasAnyMonth = true;
      }
    }

    const yearTotal = hasAnyMonth ? compoundFactor - ONE : null;

    return {
      year,
      months,
      yearTotal,
    };
  });
}

/**
 * Combines portfolio monthly returns with benchmark monthly returns to produce
 * a full comparison matrix including excess returns (alpha).
 */
export function buildMonthlyComparison(
  portfolioData: YearPerformanceData[],
  benchmarkData: YearPerformanceData[] | null | undefined,
): YearComparisonData[] {
  const benchmarkYearMap = new Map<number, YearPerformanceData>();
  if (benchmarkData) {
    for (const b of benchmarkData) {
      benchmarkYearMap.set(b.year, b);
    }
  }

  // Collect all unique years in descending order
  const allYearsSet = new Set<number>();
  for (const p of portfolioData) allYearsSet.add(p.year);
  if (benchmarkData) {
    for (const b of benchmarkData) allYearsSet.add(b.year);
  }
  const allYears = Array.from(allYearsSet).sort((a, b) => b - a);

  const portfolioYearMap = new Map<number, YearPerformanceData>();
  for (const p of portfolioData) {
    portfolioYearMap.set(p.year, p);
  }

  return allYears.map((year) => {
    const pYear = portfolioYearMap.get(year);
    const bYear = benchmarkYearMap.get(year);

    const months: (MonthlyComparisonCell | null)[] = Array(12).fill(null);

    for (let m = 0; m < 12; m++) {
      const pRet = pYear?.months[m] ?? null;
      const bRet = bYear?.months[m] ?? null;

      if (pRet === null && bRet === null) {
        months[m] = null;
      } else {
        const relativeReturn =
          pRet !== null && bRet !== null ? pRet - bRet : pRet !== null ? pRet : null;

        months[m] = {
          month: m,
          portfolioReturn: pRet,
          benchmarkReturn: bRet,
          relativeReturn,
        };
      }
    }

    const portfolioYearTotal = pYear?.yearTotal ?? null;
    const benchmarkYearTotal = bYear?.yearTotal ?? null;
    const relativeYearTotal =
      portfolioYearTotal !== null && benchmarkYearTotal !== null
        ? portfolioYearTotal - benchmarkYearTotal
        : portfolioYearTotal;

    return {
      year,
      months,
      portfolioYearTotal,
      benchmarkYearTotal,
      relativeYearTotal,
    };
  });
}

/**
 * Calculates key summary KPIs from the comparison dataset and portfolio series.
 */
export function calculatePerformanceKPIs(
  comparisonData: YearComparisonData[],
  series?: ReturnData[],
): MonthlyPerformanceKPIs {
  let bestMonth: { year: number; month: number; value: number } | null = null;
  let worstMonth: { year: number; month: number; value: number } | null = null;
  let positiveMonthsCount = 0;
  let totalMonthsCount = 0;

  for (const row of comparisonData) {
    for (let m = 0; m < 12; m++) {
      const cell = row.months[m];
      if (cell && cell.portfolioReturn !== null && Number.isFinite(cell.portfolioReturn)) {
        const val = cell.portfolioReturn;
        totalMonthsCount++;
        if (val > 0) positiveMonthsCount++;

        if (bestMonth === null || val > bestMonth.value) {
          bestMonth = { year: row.year, month: m, value: val };
        }
        if (worstMonth === null || val < worstMonth.value) {
          worstMonth = { year: row.year, month: m, value: val };
        }
      }
    }
  }

  const positiveRatio = totalMonthsCount > 0 ? (positiveMonthsCount / totalMonthsCount) * 100 : null;

  // Current year return
  const currentYear = new Date().getFullYear();
  const currentYearRow = comparisonData.find((r) => r.year === currentYear);
  const currentYearReturn = currentYearRow?.portfolioYearTotal ?? null;

  // Total cumulative return from series
  let totalCumulativeReturn: number | null = null;
  let annualizedReturn: number | null = null;

  if (series && series.length >= 2) {
    const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
    const startVal = sorted[0].value;
    const endVal = sorted[sorted.length - 1].value;
    const totalFactor = (1 + endVal) / (1 + startVal);
    totalCumulativeReturn = totalFactor - 1;

    // Calculate annualized return
    const startDate = new Date(sorted[0].date).getTime();
    const endDate = new Date(sorted[sorted.length - 1].date).getTime();
    const days = (endDate - startDate) / (1000 * 60 * 60 * 24);
    if (days >= 30 && totalFactor > 0) {
      const years = days / 365.25;
      annualizedReturn = Math.pow(totalFactor, 1 / years) - 1;
    }
  }

  // Alpha vs benchmark (compounded excess across all years with benchmark)
  let alphaVsBenchmark: number | null = null;
  let totalPortfolioCompounded = 1;
  let totalBenchmarkCompounded = 1;
  let hasBenchmarkData = false;

  for (const row of comparisonData) {
    if (row.portfolioYearTotal !== null && row.benchmarkYearTotal !== null) {
      totalPortfolioCompounded *= 1 + row.portfolioYearTotal;
      totalBenchmarkCompounded *= 1 + row.benchmarkYearTotal;
      hasBenchmarkData = true;
    }
  }

  if (hasBenchmarkData) {
    alphaVsBenchmark = (totalPortfolioCompounded - 1) - (totalBenchmarkCompounded - 1);
  }

  return {
    bestMonth,
    worstMonth,
    positiveMonthsCount,
    totalMonthsCount,
    positiveRatio,
    currentYearReturn,
    totalCumulativeReturn,
    annualizedReturn,
    alphaVsBenchmark,
  };
}

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
