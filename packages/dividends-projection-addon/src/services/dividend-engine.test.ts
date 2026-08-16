import { describe, it, expect } from 'vitest';
import {
  analyzeDividendSchedule,
  generateMonthlyProjections,
  calculateDividendsSummary,
} from './dividend-engine';
import type { Holding, DividendEvent } from '@wealthfolio/addon-sdk';

describe('Dividend Engine', () => {
  it('analyzes quarterly dividend schedule correctly', () => {
    const now = Math.floor(Date.now() / 1000);
    const day = 86400;

    // 4 quarterly payments of $0.50 per share over the last year
    const events: DividendEvent[] = [
      { amount: 0.5, date: now - 360 * day },
      { amount: 0.5, date: now - 270 * day },
      { amount: 0.52, date: now - 180 * day },
      { amount: 0.52, date: now - 90 * day },
    ];

    const result = analyzeDividendSchedule(events);
    expect(result.frequency).toBe('quarterly');
    expect(result.latestPayoutPerShare).toBe(0.52);
    expect(result.annualDividendPerShare).toBeCloseTo(2.08, 2);
    expect(result.payoutMonths.length).toBe(4);
  });

  it('analyzes monthly dividend schedule correctly', () => {
    const now = Math.floor(Date.now() / 1000);
    const day = 86400;

    const events: DividendEvent[] = [];
    for (let i = 12; i >= 1; i--) {
      events.push({ amount: 0.25, date: now - i * 30 * day });
    }

    const result = analyzeDividendSchedule(events);
    expect(result.frequency).toBe('monthly');
    expect(result.latestPayoutPerShare).toBe(0.25);
    expect(result.annualDividendPerShare).toBeCloseTo(3.0, 2);
    expect(result.payoutMonths.length).toBe(12);
  });

  it('generates 12-month projections correctly', () => {
    const testHoldings = [
      {
        holdingId: 'h1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        shares: 100,
        currentPrice: 150,
        marketValue: 15000,
        marketValueLocal: 15000,
        costBasis: 10000,
        costBasisLocal: 10000,
        currency: 'USD',
        baseCurrency: 'USD',
        fxRate: 1,
        annualDividendPerShare: 1.0,
        annualDividendLocal: 100,
        annualDividendBase: 100,
        dividendYieldPct: (100 / 15000) * 100,
        yieldOnCostPct: (100 / 10000) * 100,
        frequency: 'quarterly' as const,
        payoutMonths: [2, 5, 8, 11],
        growth12MPct: 5.5,
        growth5YPct: 7.2,
        isPayer: true,
        weightInIncomePct: 100,
        weightInPortfolioPct: 100,
      },
    ];

    const projections = generateMonthlyProjections(testHoldings, new Date('2026-01-01'));
    expect(projections.length).toBe(12);

    // February (month 2) should have a payout of $25 (100 shares * $1.00 / 4)
    const febProjection = projections.find((p) => p.month === 2);
    expect(febProjection).toBeDefined();
    expect(febProjection?.totalAmountBase).toBe(25);
    expect(febProjection?.items.length).toBe(1);
    expect(febProjection?.items[0].symbol).toBe('AAPL');

    // January (month 1) should have 0
    const janProjection = projections.find((p) => p.month === 1);
    expect(janProjection?.totalAmountBase).toBe(0);
    expect(janProjection?.items.length).toBe(0);
  });

  it('calculates full dividends summary with yield and yield on cost', () => {
    const mockHoldings: Holding[] = [
      {
        id: 'h1',
        holdingType: 'security',
        accountId: 'acc1',
        instrument: {
          id: 'asset1',
          symbol: 'MSFT',
          name: 'Microsoft Corp.',
          currency: 'USD',
          quoteMode: 'MARKET',
        },
        quantity: 50,
        localCurrency: 'USD',
        baseCurrency: 'USD',
        fxRate: 1,
        marketValue: { local: 20000, base: 20000 },
        costBasis: { local: 10000, base: 10000 },
        price: 400,
        weight: 1,
        asOfDate: '2026-08-15',
      },
    ];

    const now = Math.floor(Date.now() / 1000);
    const day = 86400;
    const mockEventsBySymbol: Record<string, DividendEvent[]> = {
      MSFT: [
        { amount: 0.75, date: now - 360 * day },
        { amount: 0.75, date: now - 270 * day },
        { amount: 0.83, date: now - 180 * day },
        { amount: 0.83, date: now - 90 * day },
      ],
    };

    const summary = calculateDividendsSummary({
      holdings: mockHoldings,
      dividendEventsBySymbol: mockEventsBySymbol,
      baseCurrency: 'USD',
    });

    expect(summary.totalMarketValue).toBe(20000);
    expect(summary.totalCostBasis).toBe(10000);
    expect(summary.payingHoldingsCount).toBe(1);
    // 50 shares * (0.83 * 4) = 50 * 3.32 = $166 annual dividend
    expect(summary.projectedAnnualIncome).toBeCloseTo(166, 1);
    // Yield = 166 / 20000 = 0.83%
    expect(summary.dividendYieldPct).toBeCloseTo(0.83, 2);
    // Yield on cost = 166 / 10000 = 1.66%
    expect(summary.yieldOnCostPct).toBeCloseTo(1.66, 2);
    expect(summary.monthlyProjections.length).toBe(12);
  });

  it('analyzes annual dividend schedule (e.g. Schneider Electric) correctly', () => {
    // 3 annual payments in May (month 5) of €3.15, €3.50, €3.80
    const events: DividendEvent[] = [
      { amount: 3.15, date: Math.floor(new Date('2023-05-15').getTime() / 1000) },
      { amount: 3.50, date: Math.floor(new Date('2024-05-15').getTime() / 1000) },
      { amount: 3.80, date: Math.floor(new Date('2025-05-15').getTime() / 1000) },
    ];

    const result = analyzeDividendSchedule(events);
    expect(result.frequency).toBe('annual');
    expect(result.latestPayoutPerShare).toBe(3.80);
    expect(result.annualDividendPerShare).toBe(3.80);
    expect(result.payoutMonths).toEqual([5]);
  });

  it('analyzes semi-annual dividend schedule (e.g. Vinci) correctly', () => {
    // Interim dividend in November + final dividend in April
    const events: DividendEvent[] = [
      { amount: 1.05, date: Math.floor(new Date('2024-11-15').getTime() / 1000) },
      { amount: 3.45, date: Math.floor(new Date('2025-04-25').getTime() / 1000) },
    ];

    const result = analyzeDividendSchedule(events);
    expect(result.frequency).toBe('semi-annual');
    expect(result.annualDividendPerShare).toBeCloseTo(4.50, 2);
    expect(result.payoutMonths).toEqual([4, 11]);
  });

  it('correctly detects and ignores ETFs in dividend summary', () => {
    const etfHolding: Holding = {
      id: 'h-etf',
      holdingType: 'security',
      accountId: 'acc1',
      instrument: {
        id: 'asset-etf',
        symbol: 'CW8',
        name: 'Amundi MSCI World UCITS ETF',
        currency: 'EUR',
        quoteMode: 'MARKET',
        classifications: {
          assetType: {
            id: 'ETF',
            key: 'ETF',
            parentId: 'ETP',
            name: 'ETF',
            color: '#000',
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
            taxonomyId: 'instrument_type',
            description: null,
          },
          assetClasses: [],
          sectors: [],
          regions: [],
          customGroups: [],
        },
      },
      quantity: 10,
      localCurrency: 'EUR',
      baseCurrency: 'EUR',
      fxRate: 1,
      marketValue: { local: 5000, base: 5000 },
      costBasis: { local: 4000, base: 4000 },
      price: 500,
      weight: 1,
      asOfDate: '2026-08-15',
    };

    const summary = calculateDividendsSummary({
      holdings: [etfHolding],
      dividendEventsBySymbol: {
        CW8: [{ amount: 10, date: Math.floor(Date.now() / 1000) }],
      },
      baseCurrency: 'EUR',
    });

    expect(summary.payingHoldingsCount).toBe(0);
    expect(summary.projectedAnnualIncome).toBe(0);
    expect(summary.holdings[0].isPayer).toBe(false);
  });
});
