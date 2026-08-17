import { describe, expect, it } from 'vitest';
import {
  buildMonthlyComparison,
  calculateMonthlyReturns,
  calculatePerformanceKPIs,
} from './monthly-performance-utils';
import type { ReturnData } from '@wealthfolio/addon-sdk';

describe('monthly-performance-utils', () => {
  it('calculates monthly returns accurately from cumulative series', () => {
    // Cumulative returns starting at 0% at beginning of Jan 2025
    // Jan 31: 5% (cumulative = 0.05) -> Jan return = +5%
    // Feb 28: 2% (cumulative = 0.02) -> Feb return = (1 + 0.02)/(1 + 0.05) - 1 = -2.857%
    // Mar 31: 10% (cumulative = 0.10) -> Mar return = (1 + 0.10)/(1 + 0.02) - 1 = +7.843%
    const series: ReturnData[] = [
      { date: '2025-01-01', value: 0 },
      { date: '2025-01-15', value: 0.02 },
      { date: '2025-01-31', value: 0.05 },
      { date: '2025-02-14', value: 0.03 },
      { date: '2025-02-28', value: 0.02 },
      { date: '2025-03-15', value: 0.06 },
      { date: '2025-03-31', value: 0.1 },
    ];

    const result = calculateMonthlyReturns(series);
    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2025);

    // Jan
    expect(result[0].months[0]).toBeCloseTo(0.05, 4);
    // Feb: (1.02 / 1.05) - 1 = -0.02857
    expect(result[0].months[1]).toBeCloseTo(1.02 / 1.05 - 1, 4);
    // Mar: (1.10 / 1.02) - 1 = 0.07843
    expect(result[0].months[2]).toBeCloseTo(1.1 / 1.02 - 1, 4);
    // Apr .. Dec should be null
    expect(result[0].months[3]).toBeNull();

    // Year total compounded should be exactly 10% (0.10)
    expect(result[0].yearTotal).toBeCloseTo(0.1, 4);
  });

  it('handles multi-year series and sorts years descending', () => {
    const series: ReturnData[] = [
      { date: '2024-11-01', value: 0 },
      { date: '2024-11-30', value: 0.02 },
      { date: '2024-12-31', value: 0.04 },
      { date: '2025-01-31', value: 0.08 },
    ];

    const result = calculateMonthlyReturns(series);
    expect(result).toHaveLength(2);
    expect(result[0].year).toBe(2025);
    expect(result[1].year).toBe(2024);

    // 2024: Nov = 2%, Dec = (1.04/1.02) - 1
    expect(result[1].months[10]).toBeCloseTo(0.02, 4);
    expect(result[1].months[11]).toBeCloseTo(1.04 / 1.02 - 1, 4);
    expect(result[1].yearTotal).toBeCloseTo(0.04, 4);

    // 2025: Jan = (1.08/1.04) - 1
    expect(result[0].months[0]).toBeCloseTo(1.08 / 1.04 - 1, 4);
    expect(result[0].yearTotal).toBeCloseTo(1.08 / 1.04 - 1, 4);
  });

  it('builds monthly comparison with benchmark and computes relative returns', () => {
    const portfolio = [
      {
        year: 2025,
        months: [0.03, -0.01, 0.05, ...Array(9).fill(null)],
        yearTotal: 1.03 * 0.99 * 1.05 - 1,
      },
    ];

    const benchmark = [
      {
        year: 2025,
        months: [0.01, 0.02, 0.03, ...Array(9).fill(null)],
        yearTotal: 1.01 * 1.02 * 1.03 - 1,
      },
    ];

    const comparison = buildMonthlyComparison(portfolio, benchmark);
    expect(comparison).toHaveLength(1);
    expect(comparison[0].year).toBe(2025);

    // Jan: portfolio 3%, benchmark 1% => relative +2%
    expect(comparison[0].months[0]?.portfolioReturn).toBe(0.03);
    expect(comparison[0].months[0]?.benchmarkReturn).toBe(0.01);
    expect(comparison[0].months[0]?.relativeReturn).toBeCloseTo(0.02, 4);

    // Feb: portfolio -1%, benchmark 2% => relative -3%
    expect(comparison[0].months[1]?.relativeReturn).toBeCloseTo(-0.03, 4);

    // Mar: portfolio 5%, benchmark 3% => relative +2%
    expect(comparison[0].months[2]?.relativeReturn).toBeCloseTo(0.02, 4);
  });

  it('calculates performance KPIs accurately', () => {
    const series: ReturnData[] = [
      { date: '2024-01-01', value: 0 },
      { date: '2024-01-31', value: 0.1 },
      { date: '2024-02-29', value: 0.05 },
      { date: '2024-03-31', value: 0.15 },
    ];

    const monthly = calculateMonthlyReturns(series);
    const comparison = buildMonthlyComparison(monthly, null);
    const kpis = calculatePerformanceKPIs(comparison, series);

    expect(kpis.totalMonthsCount).toBe(3);
    expect(kpis.positiveMonthsCount).toBe(2); // Jan (+10%), Mar (+9.52%), Feb is negative
    expect(kpis.positiveRatio).toBeCloseTo((2 / 3) * 100, 1);
    expect(kpis.bestMonth?.year).toBe(2024);
    expect(kpis.bestMonth?.value).toBeCloseTo(0.1, 4);
    expect(kpis.totalCumulativeReturn).toBeCloseTo(0.15, 4);
    expect(kpis.alphaVsBenchmark).toBeNull();
  });

  it('correctly handles missing portfolio months when calculating alpha and annual relative return', () => {
    // Portfolio started in April 2024 (Jan, Feb, Mar are null)
    const portfolio = [
      {
        year: 2024,
        months: [null, null, null, 0.04, 0.02, 0.05, ...Array(6).fill(null)],
        yearTotal: 1.04 * 1.02 * 1.05 - 1, // +11.38% (Apr-Jun)
      },
    ];

    // Benchmark has full data starting in Jan
    const benchmark = [
      {
        year: 2024,
        months: [0.03, 0.02, 0.01, 0.01, 0.01, 0.02, ...Array(6).fill(null)],
        yearTotal: 1.03 * 1.02 * 1.01 * 1.01 * 1.01 * 1.02 - 1, // Jan-Jun
      },
    ];

    const comparison = buildMonthlyComparison(portfolio, benchmark);
    expect(comparison).toHaveLength(1);

    // Jan, Feb, Mar: portfolio is missing => relativeReturn MUST be null
    expect(comparison[0].months[0]?.portfolioReturn).toBeNull();
    expect(comparison[0].months[0]?.benchmarkReturn).toBe(0.03);
    expect(comparison[0].months[0]?.relativeReturn).toBeNull();

    expect(comparison[0].months[1]?.relativeReturn).toBeNull();
    expect(comparison[0].months[2]?.relativeReturn).toBeNull();

    // Apr: portfolio 4%, benchmark 1% => relative +3%
    expect(comparison[0].months[3]?.portfolioReturn).toBe(0.04);
    expect(comparison[0].months[3]?.benchmarkReturn).toBe(0.01);
    expect(comparison[0].months[3]?.relativeReturn).toBeCloseTo(0.03, 4);

    // May: portfolio 2%, benchmark 1% => relative +1%
    expect(comparison[0].months[4]?.relativeReturn).toBeCloseTo(0.01, 4);

    // Jun: portfolio 5%, benchmark 2% => relative +3%
    expect(comparison[0].months[5]?.relativeReturn).toBeCloseTo(0.03, 4);

    // Annual relative return must ONLY compound over common months (Apr-Jun)
    // Portfolio Apr-Jun: 1.04 * 1.02 * 1.05 - 1 = 0.113824
    // Benchmark Apr-Jun: 1.01 * 1.01 * 1.02 - 1 = 0.040502
    // Alpha for year: 0.113824 - 0.040502 = 0.073322
    const expectedAlpha = (1.04 * 1.02 * 1.05 - 1) - (1.01 * 1.01 * 1.02 - 1);
    expect(comparison[0].relativeYearTotal).toBeCloseTo(expectedAlpha, 4);

    // Test KPIs alpha calculation
    const kpis = calculatePerformanceKPIs(comparison);
    expect(kpis.alphaVsBenchmark).toBeCloseTo(expectedAlpha, 4);
  });

  it('returns null relative returns and alpha when benchmark is not provided or has no common data', () => {
    const portfolio = [
      {
        year: 2024,
        months: [0.02, 0.03, ...Array(10).fill(null)],
        yearTotal: 1.02 * 1.03 - 1,
      },
    ];

    const comparison = buildMonthlyComparison(portfolio, null);
    expect(comparison[0].months[0]?.relativeReturn).toBeNull();
    expect(comparison[0].relativeYearTotal).toBeNull();

    const kpis = calculatePerformanceKPIs(comparison);
    expect(kpis.alphaVsBenchmark).toBeNull();
  });
});
