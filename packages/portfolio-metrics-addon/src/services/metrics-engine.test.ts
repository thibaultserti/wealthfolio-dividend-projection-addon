import { describe, it, expect } from 'vitest';
import {
  calculateQualityScore,
  calculateWeightedAverage,
  aggregatePortfolioMetrics,
  resolveCandidateTickers,
  isCashHolding,
  isEtfOrFund,
} from './metrics-engine';
import type { Holding, Asset } from '@wealthfolio/addon-sdk';

describe('Metrics Engine Tests', () => {
  it('correctly resolves international ticker symbols', () => {
    expect(resolveCandidateTickers('MC', 'XPAR', 'EUR').primaryTicker).toBe('MC.PA');
    expect(resolveCandidateTickers('ASML', 'XAMS', 'EUR').primaryTicker).toBe('ASML.AS');
    expect(resolveCandidateTickers('SAP', 'XETR', 'EUR').primaryTicker).toBe('SAP.DE');
    expect(resolveCandidateTickers('AAPL', 'XNAS', 'USD').primaryTicker).toBe('AAPL');
    expect(resolveCandidateTickers('SU.PA').primaryTicker).toBe('SU.PA');
  });

  it('correctly identifies cash and ETF holdings', () => {
    const cashHolding = {
      id: 'h1',
      holdingType: 'cash',
      quantity: 1000,
      marketValue: { local: 1000, base: 1000 },
    } as unknown as Holding;
    expect(isCashHolding(cashHolding)).toBe(true);

    const stockHolding = {
      id: 'h2',
      holdingType: 'security',
      quantity: 10,
      instrument: { symbol: 'AAPL', name: 'Apple Inc.' },
      marketValue: { local: 2000, base: 2000 },
    } as unknown as Holding;
    expect(isCashHolding(stockHolding)).toBe(false);
    expect(isEtfOrFund(stockHolding)).toBe(false);

    const etfHolding = {
      id: 'h3',
      holdingType: 'security',
      quantity: 50,
      instrument: { symbol: 'CW8', name: 'Amundi MSCI World UCITS ETF' },
      marketValue: { local: 5000, base: 5000 },
    } as unknown as Holding;
    expect(isEtfOrFund(etfHolding)).toBe(true);
  });

  it('calculates Note Q (Quality Score) accurately', () => {
    const highQualityStock = {
      symbol: 'MSFT',
      grossMargins: 0.69,
      operatingMargins: 0.44,
      profitMargins: 0.35,
      roic: 28,
      roce: 27,
      returnOnEquity: 0.38,
      revenueGrowth: 0.15,
      earningsGrowth: 0.20,
      netDebtToEbitda: -0.5,
      interestCoverage: 100,
      goodwillToAssets: 10,
      trailingPE: 30,
    };

    const score = calculateQualityScore(highQualityStock);
    expect(score).toBeGreaterThanOrEqual(14);
    expect(score).toBeLessThanOrEqual(20);
  });

  it('calculates weighted averages properly', () => {
    const items = [
      { value: 50, weight: 0.8 },
      { value: 10, weight: 0.2 },
    ];
    expect(calculateWeightedAverage(items)).toBe(42);

    const withNulls = [
      { value: 50, weight: 0.8 },
      { value: null, weight: 0.2 },
    ];
    expect(calculateWeightedAverage(withNulls)).toBe(50);
  });

  it('aggregates portfolio metrics with Top 5, Margins, and Valuation on cost', () => {
    const holdings: Holding[] = [
      {
        id: 'h1',
        holdingType: 'security',
        quantity: 10,
        price: 200,
        marketValue: { local: 2000, base: 2000 },
        costBasis: { local: 1000, base: 1000 }, // Gain +100%
        instrument: { symbol: 'AAPL', name: 'Apple Inc.' },
      } as unknown as Holding,
      {
        id: 'h2',
        holdingType: 'security',
        quantity: 5,
        price: 400,
        marketValue: { local: 2000, base: 2000 },
        costBasis: { local: 2000, base: 2000 },
        instrument: { symbol: 'MSFT', name: 'Microsoft Corp.' },
      } as unknown as Holding,
    ];

    const financialsBySymbol = {
      AAPL: {
        symbol: 'AAPL',
        grossMargins: 0.45,
        operatingMargins: 0.30,
        profitMargins: 0.25,
        trailingPE: 30,
        roic: 30,
        netDebtToEbitda: 0.5,
        interestCoverage: 40,
        revenueGrowth: 0.10,
      },
      MSFT: {
        symbol: 'MSFT',
        grossMargins: 0.65,
        operatingMargins: 0.40,
        profitMargins: 0.35,
        trailingPE: 35,
        roic: 28,
        netDebtToEbitda: -0.2,
        interestCoverage: 80,
        revenueGrowth: 0.15,
      },
    };

    const summary = aggregatePortfolioMetrics({
      holdings,
      financialsBySymbol,
      scope: { type: 'all' },
      baseCurrency: 'USD',
    });

    expect(summary.general.stockCount).toBe(2);
    expect(summary.general.top5Concentration).toBe(100);
    expect(summary.general.top10Concentration).toBe(100);
    expect(summary.totalMarketValue).toBe(4000);
    expect(summary.totalCostBasis).toBe(3000);

    // Margins should be 50/50 average: Gross Margin = (45 + 65) / 2 = 55%
    expect(summary.margins.grossMargin).toBe(55);
    expect(summary.margins.operatingMargin).toBe(35);
    expect(summary.margins.netMargin).toBe(30);

    // P/E Ratio current = (30 + 35) / 2 = 32.5
    expect(summary.valuation.peRatio).toBe(32.5);

    // For AAPL: Cost ratio is 1000/2000 = 0.5 -> PE on cost = 30 * 0.5 = 15
    // For MSFT: Cost ratio is 2000/2000 = 1.0 -> PE on cost = 35 * 1.0 = 35
    // Weighted PE on cost = (15 * 2000 + 35 * 2000) / 4000 = 25
    expect(summary.valuation.peOnCost).toBe(25);
  });
});
