import type { HostAPI } from '@wealthfolio/addon-sdk';
import type { RawStockFinancials } from '../types';

const STORAGE_CSV_DATA_KEY = 'portfolio_fundamentals_csv_v1';
const STORAGE_LAST_IMPORTED_KEY = 'portfolio_fundamentals_last_imported_v1';

// In-memory runtime cache
let memoryImportedData: Record<string, RawStockFinancials> | null = null;
let memoryLastImportedAt: number | null = null;

export interface ImportStats {
  importedCount: number;
  lastImportedAt: number | null;
}

export async function getImportedDataStats(api?: HostAPI): Promise<ImportStats> {
  let count = memoryImportedData ? Object.keys(memoryImportedData).length : 0;
  let lastImportedAt = memoryLastImportedAt;

  if (api?.storage) {
    try {
      if (!memoryImportedData) {
        const stored = await api.storage.get(STORAGE_CSV_DATA_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          count = Object.keys(parsed).length;
          memoryImportedData = parsed;
        }
      }
      if (!lastImportedAt) {
        const storedTime = await api.storage.get(STORAGE_LAST_IMPORTED_KEY);
        if (storedTime) {
          lastImportedAt = Number(storedTime);
          memoryLastImportedAt = lastImportedAt;
        }
      }
    } catch {}
  }

  return {
    importedCount: count,
    lastImportedAt,
  };
}

export async function clearFinancialsCache(api?: HostAPI): Promise<void> {
  memoryImportedData = null;
  memoryLastImportedAt = null;
  if (api?.storage) {
    try {
      await api.storage.set(STORAGE_CSV_DATA_KEY, '{}');
      await api.storage.set(STORAGE_LAST_IMPORTED_KEY, '0');
    } catch {}
  }
}

function parseCsvValue(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const clean = val.trim().replace('%', '').replace(',', '.');
  if (!clean || clean === 'null' || clean === 'undefined' || clean === '—' || clean === 'N/A') {
    return undefined;
  }
  const num = Number(clean);
  return isNaN(num) ? undefined : num;
}

/**
 * Parses CSV content into structured stock fundamentals
 */
export async function importFundamentalsFromCsv(
  csvText: string,
  api?: HostAPI,
): Promise<{ importedCount: number }> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error('Le fichier CSV est vide ou ne contient pas d’en-têtes valides.');
  }

  // Detect delimiter (comma or semicolon)
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));

  const symbolIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'symbol' || h.toLowerCase() === 'ticker',
  );
  if (symbolIdx === -1) {
    throw new Error('Colonne obligatoire "symbol" manquante dans le fichier CSV.');
  }

  const nameIdx = headers.findIndex((h) => h.toLowerCase() === 'name' || h.toLowerCase() === 'nom');
  const marketCapIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'marketcap' || h.toLowerCase() === 'capitalisation',
  );
  const grossMarginsIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'grossmargins' || h.toLowerCase() === 'margebrute',
  );
  const opMarginsIdx = headers.findIndex(
    (h) =>
      h.toLowerCase() === 'operatingmargins' ||
      h.toLowerCase() === 'margeop' ||
      h.toLowerCase() === 'margeoperationnelle',
  );
  const profitMarginsIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'profitmargins' || h.toLowerCase() === 'margenette',
  );
  const roicIdx = headers.findIndex((h) => h.toLowerCase() === 'roic');
  const roceIdx = headers.findIndex((h) => h.toLowerCase() === 'roce');
  const roeIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'returnonequity' || h.toLowerCase() === 'roe',
  );
  const revGrowthIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'revenuegrowth' || h.toLowerCase() === 'croissanceca',
  );
  const earnGrowthIdx = headers.findIndex(
    (h) =>
      h.toLowerCase() === 'earningsgrowth' ||
      h.toLowerCase() === 'croissanceeps' ||
      h.toLowerCase() === 'croissanceresultat',
  );
  const fcfGrowthIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'fcfgrowth' || h.toLowerCase() === 'croissancefcf',
  );
  const netDebtIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'netdebttoebitda' || h.toLowerCase() === 'dettenetteebitda',
  );
  const interestCoverageIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'interestcoverage' || h.toLowerCase() === 'couvertureinterets',
  );
  const goodwillIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'goodwilltoassets' || h.toLowerCase() === 'goodwill',
  );
  const peIdx = headers.findIndex(
    (h) =>
      h.toLowerCase() === 'trailingpe' || h.toLowerCase() === 'pe' || h.toLowerCase() === 'per',
  );
  const fwdPeIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'forwardpe' || h.toLowerCase() === 'forwardper',
  );
  const pegIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'pegratio' || h.toLowerCase() === 'peg',
  );
  const pfcfIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'pricetofreecashflow' || h.toLowerCase() === 'pfcf',
  );
  const evebitdaIdx = headers.findIndex(
    (h) => h.toLowerCase() === 'enterprisetoebitda' || h.toLowerCase() === 'evebitda',
  );

  const resultMap: Record<string, RawStockFinancials> = {};

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map((col) => col.trim().replace(/^["']|["']$/g, ''));
    const rawSymbol = row[symbolIdx]?.toUpperCase();
    if (!rawSymbol) continue;

    const baseSymbol = rawSymbol.split('.')[0]; // e.g. "AI" from "AI.PA"

    const data: RawStockFinancials = {
      symbol: rawSymbol,
      name: nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : rawSymbol,
      marketCap: marketCapIdx !== -1 ? parseCsvValue(row[marketCapIdx]) : undefined,
      grossMargins: grossMarginsIdx !== -1 ? parseCsvValue(row[grossMarginsIdx]) : undefined,
      operatingMargins: opMarginsIdx !== -1 ? parseCsvValue(row[opMarginsIdx]) : undefined,
      profitMargins: profitMarginsIdx !== -1 ? parseCsvValue(row[profitMarginsIdx]) : undefined,
      roic: roicIdx !== -1 ? parseCsvValue(row[roicIdx]) : undefined,
      roce: roceIdx !== -1 ? parseCsvValue(row[roceIdx]) : undefined,
      returnOnEquity: roeIdx !== -1 ? parseCsvValue(row[roeIdx]) : undefined,
      revenueGrowth: revGrowthIdx !== -1 ? parseCsvValue(row[revGrowthIdx]) : undefined,
      earningsGrowth: earnGrowthIdx !== -1 ? parseCsvValue(row[earnGrowthIdx]) : undefined,
      fcfGrowth: fcfGrowthIdx !== -1 ? parseCsvValue(row[fcfGrowthIdx]) : undefined,
      netDebtToEbitda: netDebtIdx !== -1 ? parseCsvValue(row[netDebtIdx]) : undefined,
      interestCoverage:
        interestCoverageIdx !== -1 ? parseCsvValue(row[interestCoverageIdx]) : undefined,
      goodwillToAssets: goodwillIdx !== -1 ? parseCsvValue(row[goodwillIdx]) : undefined,
      trailingPE: peIdx !== -1 ? parseCsvValue(row[peIdx]) : undefined,
      forwardPE: fwdPeIdx !== -1 ? parseCsvValue(row[fwdPeIdx]) : undefined,
      pegRatio: pegIdx !== -1 ? parseCsvValue(row[pegIdx]) : undefined,
      priceToFreeCashFlow: pfcfIdx !== -1 ? parseCsvValue(row[pfcfIdx]) : undefined,
      enterpriseToEbitda: evebitdaIdx !== -1 ? parseCsvValue(row[evebitdaIdx]) : undefined,
    };

    // Index under all symbol variations
    resultMap[rawSymbol] = data;
    resultMap[baseSymbol] = data;
  }

  const now = Date.now();
  memoryImportedData = resultMap;
  memoryLastImportedAt = now;

  if (api?.storage) {
    try {
      await api.storage.set(STORAGE_CSV_DATA_KEY, JSON.stringify(resultMap));
      await api.storage.set(STORAGE_LAST_IMPORTED_KEY, String(now));
    } catch {}
  }

  return {
    importedCount: Object.keys(resultMap).length / 2,
  };
}

/**
 * Retrieve fundamentals for active portfolio holdings
 */
export async function fetchStockFundamentals({
  symbols,
  api,
}: {
  symbols: { symbol: string; primaryTicker: string; fallbackTickers: string[] }[];
  api?: HostAPI;
}): Promise<{
  financialsBySymbol: Record<string, RawStockFinancials>;
  importedCount: number;
  lastImportedAt: number | null;
}> {
  let storedMap: Record<string, RawStockFinancials> = memoryImportedData || {};
  let lastImportedAt = memoryLastImportedAt;

  if (api?.storage && Object.keys(storedMap).length === 0) {
    try {
      const stored = await api.storage.get(STORAGE_CSV_DATA_KEY);
      if (stored) {
        storedMap = JSON.parse(stored);
        memoryImportedData = storedMap;
      }
      const storedTime = await api.storage.get(STORAGE_LAST_IMPORTED_KEY);
      if (storedTime) {
        lastImportedAt = Number(storedTime);
        memoryLastImportedAt = lastImportedAt;
      }
    } catch {}
  }

  const results: Record<string, RawStockFinancials> = {};

  for (const item of symbols) {
    const rawKey = item.symbol.toUpperCase();
    const primaryKey = item.primaryTicker.toUpperCase();
    const baseKey = rawKey.split('.')[0];

    const match =
      storedMap[primaryKey] ||
      storedMap[rawKey] ||
      storedMap[baseKey] ||
      item.fallbackTickers.map((t) => storedMap[t.toUpperCase()]).find(Boolean);

    if (match) {
      results[item.symbol] = match;
      results[item.primaryTicker] = match;
    }
  }

  return {
    financialsBySymbol: results,
    importedCount: Object.keys(storedMap).length,
    lastImportedAt,
  };
}
