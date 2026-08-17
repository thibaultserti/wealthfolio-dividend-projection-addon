import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HostAPI, Account, Holding, Asset } from '@wealthfolio/addon-sdk';
import type { AccountScope, PortfolioAggregatedMetrics, RawStockFinancials } from '../types';
import {
  aggregatePortfolioMetrics,
  isCashHolding,
  isEtfOrFund,
  resolveCandidateTickers,
} from '../services/metrics-engine';
import { fetchStockFundamentals } from '../services/financial-data-service';
import { Button, Badge } from '@wealthfolio/ui';
import { Layers, Folder, Wallet, CheckSquare, Square, BarChart2 } from 'lucide-react';
import { MetricsSummaryCard } from './metrics-summary-card';

interface PortfolioComparatorProps {
  api: HostAPI;
}

export const PortfolioComparator: React.FC<PortfolioComparatorProps> = ({ api }) => {
  // 1. Fetch available accounts and groups
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-scope-list'],
    queryFn: async () => {
      try {
        return await api.accounts.getAll();
      } catch {
        return [] as Account[];
      }
    },
    staleTime: 300_000,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings-info'],
    queryFn: async () => {
      try {
        return await api.settings.get();
      } catch {
        return { baseCurrency: 'USD' };
      }
    },
    staleTime: 300_000,
  });

  const baseCurrency = settings?.baseCurrency || 'USD';
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const groups = Array.from(
    new Set(activeAccounts.map((a) => a.group).filter((g): g is string => Boolean(g && g.trim()))),
  );

  // Default selected scopes for comparison (e.g. groups if present, or first two accounts)
  const defaultScopes: AccountScope[] =
    groups.length >= 2
      ? groups.slice(0, 2).map((g) => ({ type: 'group', id: g, label: g }))
      : activeAccounts.slice(0, 2).map((a) => ({ type: 'account', id: a.id, label: a.name }));

  const [selectedScopes, setSelectedScopes] = useState<AccountScope[]>(
    defaultScopes.length > 0 ? defaultScopes : [{ type: 'all', label: 'Tous les comptes' }],
  );

  // Toggle a scope in comparison
  const toggleScope = (scope: AccountScope) => {
    const exists = selectedScopes.some(
      (s) =>
        s.type === scope.type && (s.id === scope.id || (s.type === 'all' && scope.type === 'all')),
    );

    if (exists) {
      if (selectedScopes.length > 1) {
        setSelectedScopes(
          selectedScopes.filter(
            (s) =>
              !(
                s.type === scope.type &&
                (s.id === scope.id || (s.type === 'all' && scope.type === 'all'))
              ),
          ),
        );
      }
    } else {
      if (selectedScopes.length < 4) {
        setSelectedScopes([...selectedScopes, scope]);
      }
    }
  };

  const isScopeSelected = (scope: AccountScope) =>
    selectedScopes.some(
      (s) =>
        s.type === scope.type && (s.id === scope.id || (s.type === 'all' && scope.type === 'all')),
    );

  // 2. Fetch metrics for all selected scopes
  const { data: comparisonMetrics = [], isLoading } = useQuery<PortfolioAggregatedMetrics[]>({
    queryKey: ['portfolio-comparison-metrics', selectedScopes],
    queryFn: async () => {
      const results: PortfolioAggregatedMetrics[] = [];

      for (const scope of selectedScopes) {
        let targetAccounts: Account[] = [];
        if (scope.type === 'all') {
          targetAccounts = activeAccounts;
        } else if (scope.type === 'group') {
          targetAccounts = activeAccounts.filter((a) => a.group === scope.id);
        } else if (scope.type === 'account') {
          targetAccounts = activeAccounts.filter((a) => a.id === scope.id);
        }

        const holdingsPromises = targetAccounts.map(async (acc) => {
          try {
            return await api.portfolio.getHoldings(acc.id);
          } catch {
            return [] as Holding[];
          }
        });

        const holdingsArrays = await Promise.all(holdingsPromises);
        const rawHoldings = holdingsArrays.flat();

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
          (h) => (Number(h.quantity) || 0) > 0 && !isCashHolding(h),
        );

        const assetProfilesById: Record<string, Asset> = {};
        await Promise.all(
          mergedHoldings.map(async (h) => {
            const assetId = h.instrument?.id;
            if (assetId && !assetId.startsWith('cash:')) {
              try {
                const profile = await api.assets.getProfile(assetId);
                if (profile) assetProfilesById[assetId] = profile;
              } catch {}
            }
          }),
        );

        const candidates: { symbol: string; primaryTicker: string; fallbackTickers: string[] }[] =
          [];
        for (const h of mergedHoldings) {
          const rawSymbol = h.instrument?.symbol;
          if (!rawSymbol) continue;
          const profile = h.instrument?.id ? assetProfilesById[h.instrument.id] : undefined;
          if (isEtfOrFund(h, profile)) continue;

          const resolved = resolveCandidateTickers(
            rawSymbol,
            profile?.instrumentExchangeMic || undefined,
            profile?.quoteCcy || h.localCurrency,
          );

          candidates.push({
            symbol: rawSymbol,
            primaryTicker: resolved.primaryTicker,
            fallbackTickers: resolved.fallbackTickers,
          });
        }

        let financialsBySymbol: Record<string, RawStockFinancials> = {};
        try {
          const resp = await fetchStockFundamentals({ symbols: candidates, api });
          financialsBySymbol = resp.financialsBySymbol;
        } catch {
          financialsBySymbol = {};
        }

        const aggregated = aggregatePortfolioMetrics({
          holdings: mergedHoldings,
          financialsBySymbol,
          assetProfilesById,
          scope,
          baseCurrency,
        });

        results.push(aggregated);
      }

      return results;
    },
    staleTime: 300_000,
  });

  const fmtPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return `${val.toFixed(2)}%`;
  };

  const fmtNum = (val: number | null | undefined, suffix = '', decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return `${val.toFixed(decimals)}${suffix}`;
  };

  return (
    <div className="space-y-6">
      {/* Scope Selector Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">Sélectionner les portefeuilles à comparer</h3>
            <p className="text-xs text-muted-foreground">
              Cochez jusqu'à 4 comptes ou groupes pour afficher l'analyse comparative
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {selectedScopes.length} sélectionné(s) (max 4)
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {/* All Accounts option */}
          <Button
            variant={isScopeSelected({ type: 'all' }) ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 text-xs flex items-center gap-1.5"
            onClick={() => toggleScope({ type: 'all', label: 'Tous les comptes' })}
          >
            {isScopeSelected({ type: 'all' }) ? (
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Square className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Tous les comptes</span>
          </Button>

          {/* Groups */}
          {groups.map((group) => {
            const scope: AccountScope = { type: 'group', id: group, label: group };
            const selected = isScopeSelected(scope);
            return (
              <Button
                key={group}
                variant={selected ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 text-xs flex items-center gap-1.5"
                onClick={() => toggleScope(scope)}
              >
                {selected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>Portefeuille : {group}</span>
              </Button>
            );
          })}

          {/* Accounts */}
          {activeAccounts.map((account) => {
            const scope: AccountScope = { type: 'account', id: account.id, label: account.name };
            const selected = isScopeSelected(scope);
            return (
              <Button
                key={account.id}
                variant={selected ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 text-xs flex items-center gap-1.5"
                onClick={() => toggleScope(scope)}
              >
                {selected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <Wallet className="w-3.5 h-3.5 text-blue-500" />
                <span>{account.name}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          Calcul des statistiques comparatives...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Side-by-Side Comparison Table */}
          <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold tracking-tight">Tableau Comparatif des Métriques</h3>

            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="py-3 px-4 text-left w-1/3">Métrique</th>
                    {comparisonMetrics.map((cm, idx) => (
                      <th key={idx} className="py-3 px-4 text-right font-bold text-foreground">
                        {cm.scope.label ||
                          (cm.scope.type === 'all' ? 'Tous les comptes' : cm.scope.id)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {/* Général */}
                  <tr className="bg-muted/20 font-semibold text-foreground/80">
                    <td
                      colSpan={comparisonMetrics.length + 1}
                      className="py-2 px-4 uppercase text-[10px] tracking-wider"
                    >
                      Général
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Note Q (Score Qualité)</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right">
                        <span className="font-bold text-emerald-500 text-sm">
                          {cm.general.qualityScore} / 20
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Nombre d'actions</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-medium">
                        {cm.general.stockCount}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Concentration Top 5</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-medium">
                        {cm.general.top5Concentration}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Concentration Top 10</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-medium">
                        {cm.general.top10Concentration}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Market Cap moyenne pondérée</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-medium">
                        {fmtNum(cm.general.weightedMarketCap, ' M$')}
                      </td>
                    ))}
                  </tr>

                  {/* Marges */}
                  <tr className="bg-muted/20 font-semibold text-foreground/80">
                    <td
                      colSpan={comparisonMetrics.length + 1}
                      className="py-2 px-4 uppercase text-[10px] tracking-wider"
                    >
                      Marges
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Marge brute</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold text-emerald-500">
                        {fmtPercent(cm.margins.grossMargin)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Marge opérationnelle</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold text-emerald-500">
                        {fmtPercent(cm.margins.operatingMargin)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Marge nette</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold text-emerald-500">
                        {fmtPercent(cm.margins.netMargin)}
                      </td>
                    ))}
                  </tr>

                  {/* Retours sur capitaux */}
                  <tr className="bg-muted/20 font-semibold text-foreground/80">
                    <td
                      colSpan={comparisonMetrics.length + 1}
                      className="py-2 px-4 uppercase text-[10px] tracking-wider"
                    >
                      Retours sur capitaux
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">ROIC</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold text-emerald-500">
                        {fmtPercent(cm.returnsOnCapital.roic)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">ROCE</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold text-emerald-500">
                        {fmtPercent(cm.returnsOnCapital.roce)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">ROE</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold text-emerald-500">
                        {fmtPercent(cm.returnsOnCapital.roe)}
                      </td>
                    ))}
                  </tr>

                  {/* Croissance */}
                  <tr className="bg-muted/20 font-semibold text-foreground/80">
                    <td
                      colSpan={comparisonMetrics.length + 1}
                      className="py-2 px-4 uppercase text-[10px] tracking-wider"
                    >
                      Croissance
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Croissance revenus</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold">
                        {fmtPercent(cm.growth.revenueGrowth)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Croissance EPS</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold">
                        {fmtPercent(cm.growth.epsGrowth)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Croissance FCF</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-semibold">
                        {fmtPercent(cm.growth.fcfGrowth)}
                      </td>
                    ))}
                  </tr>

                  {/* Santé */}
                  <tr className="bg-muted/20 font-semibold text-foreground/80">
                    <td
                      colSpan={comparisonMetrics.length + 1}
                      className="py-2 px-4 uppercase text-[10px] tracking-wider"
                    >
                      Santé financière
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Dette nette / EBITDA</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-medium">
                        {fmtPercent(cm.health.netDebtToEbitda)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Interests Coverage</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-medium">
                        {fmtNum(cm.health.interestCoverage)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Goodwill / Assets</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-medium">
                        {fmtPercent(cm.health.goodwillToAssets)}
                      </td>
                    ))}
                  </tr>

                  {/* Valorisation */}
                  <tr className="bg-muted/20 font-semibold text-foreground/80">
                    <td
                      colSpan={comparisonMetrics.length + 1}
                      className="py-2 px-4 uppercase text-[10px] tracking-wider"
                    >
                      Valorisation
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">P/E Ratio (Actuel)</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-mono font-medium">
                        {fmtNum(cm.valuation.peRatio)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">Forward P/E</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-mono font-medium">
                        {fmtNum(cm.valuation.forwardPE)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">PEG Ratio</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td
                        key={idx}
                        className="py-2 px-4 text-right font-mono font-medium text-emerald-400"
                      >
                        {fmtNum(cm.valuation.pegRatio, '', 2)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">P/E sur coût</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td
                        key={idx}
                        className="py-2 px-4 text-right font-mono font-medium text-emerald-500"
                      >
                        {fmtNum(cm.valuation.peOnCost)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">P/FCF Ratio</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td key={idx} className="py-2 px-4 text-right font-mono font-medium">
                        {fmtNum(cm.valuation.pfcfRatio)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-muted-foreground">P/FCF sur coût</td>
                    {comparisonMetrics.map((cm, idx) => (
                      <td
                        key={idx}
                        className="py-2 px-4 text-right font-mono font-medium text-emerald-500"
                      >
                        {fmtNum(cm.valuation.pfcfOnCost)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards Grid comparison */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {comparisonMetrics.map((cm, idx) => (
              <MetricsSummaryCard
                key={idx}
                metrics={cm}
                title={`Statistiques : ${cm.scope.label || (cm.scope.type === 'all' ? 'Tous les comptes' : cm.scope.id)}`}
                subtitle={`Valeur totale des actions : ${cm.totalMarketValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${baseCurrency}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
