import React, { useState, useMemo } from 'react';
import type { StockHoldingMetric } from '../types';
import {
  Input,
  Button,
  Badge,
} from '@wealthfolio/ui';
import {
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react';

interface HoldingsMetricsTableProps {
  holdings: StockHoldingMetric[];
  baseCurrency: string;
}

type SortField =
  | 'weight'
  | 'qualityScore'
  | 'marketValue'
  | 'grossMargin'
  | 'operatingMargin'
  | 'netMargin'
  | 'roic'
  | 'revenueGrowth'
  | 'epsGrowth'
  | 'peRatio'
  | 'peOnCost'
  | 'symbol';

export const HoldingsMetricsTable: React.FC<HoldingsMetricsTableProps> = ({
  holdings,
  baseCurrency,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('weight');
  const [sortAsc, setSortAsc] = useState(false);
  const [minQualityFilter, setMinQualityFilter] = useState<number | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredAndSorted = useMemo(() => {
    return holdings
      .filter((h) => {
        if (minQualityFilter !== null && h.qualityScore < minQualityFilter) {
          return false;
        }
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          h.symbol.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (valA === null || valA === undefined) valA = sortAsc ? Infinity : -Infinity;
        if (valB === null || valB === undefined) valB = sortAsc ? Infinity : -Infinity;

        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [holdings, searchTerm, sortField, sortAsc, minQualityFilter]);

  const fmtPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return `${val.toFixed(1)}%`;
  };

  const fmtNum = (val: number | null | undefined, decimals = 1) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return val.toFixed(decimals);
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-sm space-y-4">
      {/* Header with Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold tracking-tight">Détail des positions actions</h3>
          <p className="text-xs text-muted-foreground">
            Vue détaillée des fondamentaux, valorisations et scores par action
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher ticker ou nom..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 text-xs">
            <Button
              variant={minQualityFilter === null ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setMinQualityFilter(null)}
            >
              Tous
            </Button>
            <Button
              variant={minQualityFilter === 12 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400"
              onClick={() => setMinQualityFilter(12)}
            >
              Note Q ≥ 12
            </Button>
            <Button
              variant={minQualityFilter === 15 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs text-emerald-500 font-bold"
              onClick={() => setMinQualityFilter(15)}
            >
              Note Q ≥ 15 ★
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground font-medium">
              <th className="py-2.5 px-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('symbol')}>
                <div className="flex items-center gap-1">
                  <span>Action</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('weight')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Poids</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground" onClick={() => handleSort('qualityScore')}>
                <div className="flex items-center justify-center gap-1">
                  <span>Note Q</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('grossMargin')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Marge brute</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('netMargin')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Marge nette</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('roic')}>
                <div className="flex items-center justify-end gap-1">
                  <span>ROIC</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('revenueGrowth')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Croiss. CA</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('peRatio')}>
                <div className="flex items-center justify-end gap-1">
                  <span>P/E</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('peOnCost')}>
                <div className="flex items-center justify-end gap-1">
                  <span>P/E sur coût</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('marketValue')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Valeur ({baseCurrency})</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-muted-foreground text-sm">
                  Aucune position action trouvée.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((h) => {
                const isHighQuality = h.qualityScore >= 14;
                const isMediumQuality = h.qualityScore >= 9 && h.qualityScore < 14;

                return (
                  <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                    {/* Action */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{h.symbol}</span>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[140px] sm:max-w-[200px]">
                          {h.name}
                        </span>
                      </div>
                    </td>

                    {/* Poids */}
                    <td className="py-2.5 px-3 text-right font-medium">
                      {h.weight.toFixed(1)}%
                    </td>

                    {/* Note Q */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-xs ${
                          isHighQuality
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            : isMediumQuality
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                        }`}
                      >
                        {h.qualityScore} / 20
                      </span>
                    </td>

                    {/* Marge brute */}
                    <td className="py-2.5 px-3 text-right">
                      <span className={h.grossMargin && h.grossMargin >= 40 ? 'text-emerald-500 font-medium' : ''}>
                        {fmtPercent(h.grossMargin)}
                      </span>
                    </td>

                    {/* Marge nette */}
                    <td className="py-2.5 px-3 text-right">
                      <span className={h.netMargin && h.netMargin >= 15 ? 'text-emerald-500 font-medium' : ''}>
                        {fmtPercent(h.netMargin)}
                      </span>
                    </td>

                    {/* ROIC */}
                    <td className="py-2.5 px-3 text-right">
                      <span className={h.roic && h.roic >= 15 ? 'text-emerald-500 font-medium' : ''}>
                        {fmtPercent(h.roic)}
                      </span>
                    </td>

                    {/* Croissance CA */}
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={
                          h.revenueGrowth != null
                            ? h.revenueGrowth >= 0
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                            : ''
                        }
                      >
                        {fmtPercent(h.revenueGrowth)}
                      </span>
                    </td>

                    {/* P/E */}
                    <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                      {fmtNum(h.peRatio)}
                    </td>

                    {/* P/E sur coût */}
                    <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                      <span
                        className={
                          h.peOnCost && h.peRatio && h.peOnCost < h.peRatio
                            ? 'text-emerald-500 font-semibold'
                            : ''
                        }
                      >
                        {fmtNum(h.peOnCost)}
                      </span>
                    </td>

                    {/* Market Value */}
                    <td className="py-2.5 px-3 text-right font-medium">
                      {h.marketValue.toLocaleString('fr-FR', {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
