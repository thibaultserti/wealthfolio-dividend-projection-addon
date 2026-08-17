import { useQuery } from '@tanstack/react-query';
import type {
  HostAPI,
  Account,
  Holding,
  DividendEvent,
  ActivityDetails,
  Asset,
} from '@wealthfolio/addon-sdk';
import type { AccountScope, DividendsSummary } from '../types';
import { calculateDividendsSummary, isEtfOrFund, isCash } from '../services/dividend-engine';

/**
 * Determine the optimal Yahoo ticker query based on symbol, exchange MIC, and currency.
 */
function resolveCandidateTickers(
  symbol: string,
  exchangeMic?: string,
  currency?: string,
): { primaryTicker: string; fallbackTickers: string[]; effectiveMic?: string } {
  const cleanSymbol = symbol.trim().toUpperCase();

  // If already contains a dot-suffix (e.g., SU.PA, RMS.PA, AAPL.US, MC.PA, SAP.DE), use it directly
  if (cleanSymbol.includes('.')) {
    return {
      primaryTicker: cleanSymbol,
      fallbackTickers: [cleanSymbol.split('.')[0]],
      effectiveMic: exchangeMic,
    };
  }

  const mic = (exchangeMic || '').toUpperCase();
  const ccy = (currency || '').toUpperCase();

  // European EUR assets (Euronext Paris, Amsterdam, Brussels, Frankfurt, Milan, Madrid)
  if (mic === 'XPAR' || (ccy === 'EUR' && (!mic || mic === 'PAR' || mic === 'ENX'))) {
    return {
      primaryTicker: `${cleanSymbol}.PA`,
      fallbackTickers: [cleanSymbol],
      effectiveMic: 'XPAR',
    };
  }

  if (mic === 'XAMS' || (ccy === 'EUR' && mic === 'AMS')) {
    return {
      primaryTicker: `${cleanSymbol}.AS`,
      fallbackTickers: [`${cleanSymbol}.PA`, cleanSymbol],
      effectiveMic: 'XAMS',
    };
  }

  if (mic === 'XBRU' || (ccy === 'EUR' && mic === 'BRU')) {
    return {
      primaryTicker: `${cleanSymbol}.BR`,
      fallbackTickers: [`${cleanSymbol}.PA`, cleanSymbol],
      effectiveMic: 'XBRU',
    };
  }

  if (mic === 'XETR' || mic === 'XFRA' || mic === 'FRA') {
    return {
      primaryTicker: `${cleanSymbol}.DE`,
      fallbackTickers: [`${cleanSymbol}.F`, cleanSymbol],
      effectiveMic: 'XETR',
    };
  }

  if (mic === 'XMIL' || mic === 'MTAA') {
    return {
      primaryTicker: `${cleanSymbol}.MI`,
      fallbackTickers: [cleanSymbol],
      effectiveMic: 'XMIL',
    };
  }

  if (mic === 'XMAD' || mic === 'MCE') {
    return {
      primaryTicker: `${cleanSymbol}.MC`,
      fallbackTickers: [cleanSymbol],
      effectiveMic: 'XMAD',
    };
  }

  // London / UK (GBP / GBp)
  if (mic === 'XLON' || ccy === 'GBP' || ccy === 'GBP') {
    return {
      primaryTicker: `${cleanSymbol}.L`,
      fallbackTickers: [cleanSymbol],
      effectiveMic: 'XLON',
    };
  }

  // Canada (CAD)
  if (mic === 'XTSE' || mic === 'XTSX' || ccy === 'CAD') {
    return {
      primaryTicker: `${cleanSymbol}.TO`,
      fallbackTickers: [`${cleanSymbol}.V`, cleanSymbol],
      effectiveMic: 'XTSE',
    };
  }

  // Default / US stocks (USD)
  return {
    primaryTicker: cleanSymbol,
    fallbackTickers: ccy === 'EUR' ? [`${cleanSymbol}.PA`] : [],
    effectiveMic: mic || undefined,
  };
}

export function useDividendData({ api, scope }: { api: HostAPI; scope: AccountScope }) {
  return useQuery<DividendsSummary, Error>({
    queryKey: ['dividends-projection-data', scope],
    queryFn: async () => {
      // 1. Fetch Accounts & Settings
      const [accounts, settings] = await Promise.all([
        api.accounts.getAll().catch(() => [] as Account[]),
        api.settings.get().catch(() => ({ baseCurrency: 'USD' })),
      ]);

      const baseCurrency = settings.baseCurrency || 'USD';

      // 2. Determine target accounts based on scope
      let targetAccounts: Account[] = [];
      if (scope.type === 'all') {
        targetAccounts = accounts.filter((a) => !a.isArchived);
      } else if (scope.type === 'group') {
        targetAccounts = accounts.filter((a) => !a.isArchived && a.group === scope.id);
      } else if ((scope.type === 'account' || scope.type === 'portfolio') && scope.id) {
        targetAccounts = accounts.filter((a) => a.id === scope.id);
      } else {
        targetAccounts = accounts.filter((a) => !a.isArchived);
      }

      // 3. Fetch holdings for each target account
      const holdingsPromises = targetAccounts.map(async (acc) => {
        try {
          return await api.portfolio.getHoldings(acc.id);
        } catch {
          return [] as Holding[];
        }
      });

      const holdingsArrays = await Promise.all(holdingsPromises);
      const rawHoldings = holdingsArrays.flat();

      // Aggregate identical assets across accounts
      const mergedHoldingsMap = new Map<string, Holding>();
      for (const h of rawHoldings) {
        const key = h.instrument?.symbol || h.instrument?.id || h.id;
        const existing = mergedHoldingsMap.get(key);
        if (existing) {
          existing.quantity = (Number(existing.quantity) || 0) + (Number(h.quantity) || 0);
          if (existing.marketValue && h.marketValue) {
            existing.marketValue.local =
              (Number(existing.marketValue.local) || 0) + (Number(h.marketValue.local) || 0);
            existing.marketValue.base =
              (Number(existing.marketValue.base) || 0) + (Number(h.marketValue.base) || 0);
          }
          if (existing.costBasis && h.costBasis) {
            existing.costBasis.local =
              (Number(existing.costBasis.local) || 0) + (Number(h.costBasis.local) || 0);
            existing.costBasis.base =
              (Number(existing.costBasis.base) || 0) + (Number(h.costBasis.base) || 0);
          }
        } else {
          mergedHoldingsMap.set(key, {
            ...h,
            marketValue: {
              local: Number(h.marketValue?.local) || 0,
              base: Number(h.marketValue?.base) || 0,
            },
            costBasis: {
              local: Number(h.costBasis?.local) || 0,
              base: Number(h.costBasis?.base) || 0,
            },
          });
        }
      }

      const mergedHoldings = Array.from(mergedHoldingsMap.values()).filter(
        (h) => (Number(h.quantity) || 0) > 0 && !isCash(h),
      );

      // 4. Fetch asset profiles to resolve exact exchange MICs and quote currencies
      const assetProfilesById: Record<string, Asset> = {};
      await Promise.all(
        mergedHoldings.map(async (h) => {
          const assetId = h.instrument?.id;
          if (assetId && !assetId.startsWith('cash:') && !isCash(h)) {
            try {
              const profile = await api.assets.getProfile(assetId);
              if (profile) {
                assetProfilesById[assetId] = profile;
              }
            } catch {
              // Ignore profile fetch failure
            }
          }
        }),
      );

      // 5. Fetch dividend events for each unique holding with accurate exchange resolution
      const dividendEventsBySymbol: Record<string, DividendEvent[]> = {};

      await Promise.all(
        mergedHoldings.map(async (h) => {
          const rawSymbol = h.instrument?.symbol;
          if (!rawSymbol) return;

          // Skip Cash and ETF / Fund assets
          if (isCash(h) || isEtfOrFund(h)) return;

          const assetId = h.instrument?.id;
          const profile = assetId ? assetProfilesById[assetId] : undefined;

          const exchangeMic =
            profile?.instrumentExchangeMic ||
            (h.instrument as unknown as { exchangeMic?: string })?.exchangeMic;
          const currency =
            profile?.quoteCcy || h.localCurrency || h.instrument?.currency || baseCurrency;
          const instrumentType = profile?.instrumentType || undefined;
          const providerId =
            (profile?.providerConfig as { preferred_provider?: string })?.preferred_provider ||
            h.instrument?.preferredProvider ||
            undefined;

          const { primaryTicker, fallbackTickers, effectiveMic } = resolveCandidateTickers(
            rawSymbol,
            exchangeMic,
            currency,
          );

          let events: DividendEvent[] = [];

          // Try primary resolved ticker
          try {
            events = await api.market.fetchDividends(primaryTicker, {
              exchangeMic: effectiveMic,
              quoteCcy: currency,
              instrumentType,
              providerId,
            });
          } catch {
            events = [];
          }

          // If empty, try fallbacks
          if (!events || events.length === 0) {
            for (const fallback of fallbackTickers) {
              try {
                const fbEvents = await api.market.fetchDividends(fallback, {
                  exchangeMic: effectiveMic,
                  quoteCcy: currency,
                  instrumentType,
                });
                if (fbEvents && fbEvents.length > 0) {
                  events = fbEvents;
                  break;
                }
              } catch {
                // Continue to next fallback
              }
            }
          }

          const finalEvents = events || [];

          // Map events to all possible lookup keys (raw symbol, primary ticker, asset ID, holding ID)
          dividendEventsBySymbol[rawSymbol] = finalEvents;
          dividendEventsBySymbol[primaryTicker] = finalEvents;
          if (assetId) {
            dividendEventsBySymbol[assetId] = finalEvents;
          }
          if (h.id) {
            dividendEventsBySymbol[h.id] = finalEvents;
          }
        }),
      );

      // 6. Fetch activities to calculate historical dividend transactions and fallback
      let activities: ActivityDetails[] = [];
      try {
        if ((scope.type === 'account' || scope.type === 'portfolio') && scope.id) {
          activities = await api.activities.getAll(scope.id);
        } else {
          const allActivities = await api.activities.getAll();
          const targetAccountIds = new Set(targetAccounts.map((a) => a.id));
          activities = allActivities.filter((a) => targetAccountIds.has(a.accountId));
        }
      } catch {
        activities = [];
      }

      // 7. Compute summary
      return calculateDividendsSummary({
        holdings: mergedHoldings,
        dividendEventsBySymbol,
        activities,
        baseCurrency,
      });
    },
    staleTime: 60_000,
  });
}
