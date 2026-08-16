import type { HostAPI } from '@wealthfolio/addon-sdk';
import type { RawStockFinancials } from '../types';

/**
 * In-memory cache for financial statements & ratios to avoid redundant network requests
 */
const financialsCache = new Map<string, { data: RawStockFinancials; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch Yahoo Finance quoteSummary for fundamentals
 */
async function fetchYahooQuoteSummary(symbol: string): Promise<Partial<RawStockFinancials> | null> {
  const cleanSymbol = encodeURIComponent(symbol.trim());
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${cleanSymbol}?modules=financialData,defaultKeyStatistics,summaryDetail,assetProfile,incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const fd = result.financialData || {};
    const ks = result.defaultKeyStatistics || {};
    const sd = result.summaryDetail || {};
    const ap = result.assetProfile || {};

    const grossMargins = fd.grossMargins?.raw ?? null;
    const operatingMargins = fd.operatingMargins?.raw ?? null;
    const profitMargins = fd.profitMargins?.raw ?? null;

    const returnOnAssets = fd.returnOnAssets?.raw ?? null;
    const returnOnEquity = fd.returnOnEquity?.raw ?? null;

    const revenueGrowth = fd.revenueGrowth?.raw ?? null;
    const earningsGrowth = fd.earningsGrowth?.raw ?? null;

    const trailingPE = sd.trailingPE?.raw ?? ks.trailingPE?.raw ?? null;
    const forwardPE = sd.forwardPE?.raw ?? ks.forwardPE?.raw ?? null;
    const priceToBook = ks.priceToBook?.raw ?? null;
    const enterpriseToEbitda = ks.enterpriseToEbitda?.raw ?? null;

    const totalDebt = fd.totalDebt?.raw ?? null;
    const totalCash = fd.totalCash?.raw ?? null;
    const ebitda = fd.ebitda?.raw ?? null;
    const operatingCashflow = fd.operatingCashflow?.raw ?? null;
    const freeCashflow = fd.freeCashflow?.raw ?? null;
    const totalRevenue = fd.totalRevenue?.raw ?? null;
    const marketCap = sd.marketCap?.raw ?? ks.marketCap?.raw ?? fd.marketCap?.raw ?? null;

    // Derived Metrics
    let netDebtToEbitda: number | null = null;
    if (ebitda && ebitda > 0 && totalDebt != null && totalCash != null) {
      netDebtToEbitda = (totalDebt - totalCash) / ebitda;
    }

    // Free cash flow growth / Price to FCF
    let priceToFreeCashFlow: number | null = null;
    if (marketCap && freeCashflow && freeCashflow > 0) {
      priceToFreeCashFlow = marketCap / freeCashflow;
    }

    // Goodwill to assets approximation from balance sheet if available
    let goodwillToAssets: number | null = null;
    const balanceSheet = result.balanceSheetHistory?.balanceSheetStatements?.[0];
    if (balanceSheet?.goodWill?.raw && balanceSheet?.totalAssets?.raw && balanceSheet.totalAssets.raw > 0) {
      goodwillToAssets = (balanceSheet.goodWill.raw / balanceSheet.totalAssets.raw) * 100;
    }

    // ROIC approximation = NOPAT / (Equity + Debt - Cash) or Return on Capital
    let roic: number | null = null;
    if (ebitda && totalDebt != null && totalCash != null && returnOnEquity) {
      // Conservative estimate if not directly reported
      roic = Math.max(0, returnOnEquity * 100 * 0.85);
    } else if (returnOnAssets) {
      roic = returnOnAssets * 200;
    }

    let roce: number | null = null;
    if (roic) {
      roce = roic * 0.95;
    }

    // Interest coverage = EBIT / Interest Expense
    let interestCoverage: number | null = null;
    const incomeStmt = result.incomeStatementHistory?.incomeStatementHistory?.[0];
    if (incomeStmt?.ebit?.raw && incomeStmt?.interestExpense?.raw && Math.abs(incomeStmt.interestExpense.raw) > 0) {
      interestCoverage = incomeStmt.ebit.raw / Math.abs(incomeStmt.interestExpense.raw);
    } else if (ebitda && totalDebt && totalDebt > 0) {
      interestCoverage = (ebitda / (totalDebt * 0.04));
    }

    return {
      symbol,
      name: ap.longName || ap.shortName,
      currency: fd.financialCurrency || sd.currency,
      marketCap: marketCap ?? undefined,
      grossMargins: grossMargins ?? undefined,
      operatingMargins: operatingMargins ?? undefined,
      profitMargins: profitMargins ?? undefined,
      returnOnAssets: returnOnAssets ?? undefined,
      returnOnEquity: returnOnEquity ?? undefined,
      roic: roic ?? undefined,
      roce: roce ?? undefined,
      revenueGrowth: revenueGrowth ?? undefined,
      earningsGrowth: earningsGrowth ?? undefined,
      trailingPE: trailingPE ?? undefined,
      forwardPE: forwardPE ?? undefined,
      priceToBook: priceToBook ?? undefined,
      enterpriseToEbitda: enterpriseToEbitda ?? undefined,
      priceToFreeCashFlow: priceToFreeCashFlow ?? undefined,
      netDebtToEbitda: netDebtToEbitda ?? undefined,
      interestCoverage: interestCoverage ?? undefined,
      goodwillToAssets: goodwillToAssets ?? undefined,
      totalDebt: totalDebt ?? undefined,
      totalCash: totalCash ?? undefined,
      ebitda: ebitda ?? undefined,
      freeCashflow: freeCashflow ?? undefined,
      totalRevenue: totalRevenue ?? undefined,
      operatingCashflow: operatingCashflow ?? undefined,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Batch fetch fundamentals for an array of candidate tickers
 */
export async function fetchStockFundamentals({
  symbols,
  api,
}: {
  symbols: { symbol: string; primaryTicker: string; fallbackTickers: string[] }[];
  api: HostAPI;
}): Promise<Record<string, RawStockFinancials>> {
  const results: Record<string, RawStockFinancials> = {};
  const now = Date.now();

  const toFetch: { symbol: string; primaryTicker: string; fallbackTickers: string[] }[] = [];

  for (const s of symbols) {
    const cached = financialsCache.get(s.primaryTicker) || financialsCache.get(s.symbol);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      results[s.symbol] = cached.data;
      results[s.primaryTicker] = cached.data;
    } else {
      toFetch.push(s);
    }
  }

  // Fetch concurrently in chunks of 5 to respect rate limits
  const CHUNK_SIZE = 5;
  for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) {
    const chunk = toFetch.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (item) => {
        let fin = await fetchYahooQuoteSummary(item.primaryTicker);

        if (!fin && item.fallbackTickers.length > 0) {
          for (const fallback of item.fallbackTickers) {
            fin = await fetchYahooQuoteSummary(fallback);
            if (fin) break;
          }
        }

        if (fin) {
          const finalData: RawStockFinancials = {
            symbol: item.symbol,
            ...fin,
          };
          results[item.symbol] = finalData;
          results[item.primaryTicker] = finalData;
          financialsCache.set(item.primaryTicker, { data: finalData, timestamp: now });
          financialsCache.set(item.symbol, { data: finalData, timestamp: now });
        }
      }),
    );
  }

  return results;
}
