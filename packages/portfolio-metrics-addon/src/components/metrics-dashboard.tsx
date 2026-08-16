import React, { useState } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';
import type { AccountScope } from '../types';
import { usePortfolioMetrics } from '../hooks/use-portfolio-metrics';
import { AccountScopeFilter } from './account-scope-filter';
import { MetricsSummaryCard } from './metrics-summary-card';
import { HoldingsMetricsTable } from './holdings-metrics-table';
import { PortfolioComparator } from './portfolio-comparator';
import { Button, Badge } from '@wealthfolio/ui';
import {
  BarChart3,
  GitCompare,
  RefreshCw,
  TrendingUp,
  Award,
  DollarSign,
  PieChart,
  Percent,
} from 'lucide-react';

interface MetricsDashboardProps {
  api: HostAPI;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ api }) => {
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [scope, setScope] = useState<AccountScope>({
    type: 'all',
    label: 'Tous les comptes',
  });

  const { data: metrics, isLoading, isFetching, refetch, error } = usePortfolioMetrics({
    api,
    scope,
  });

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Métriques Fondamentales du Portefeuille
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Analyse approfondie des marges, rentabilités sur capitaux, santé financière, valorisations et Note Q
          </p>
        </div>

        {/* Tab Switch & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/60">
            <Button
              variant={activeTab === 'single' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs font-semibold flex items-center gap-1.5"
              onClick={() => setActiveTab('single')}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Vue Portefeuille</span>
            </Button>
            <Button
              variant={activeTab === 'compare' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs font-semibold flex items-center gap-1.5"
              onClick={() => setActiveTab('compare')}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Comparateur</span>
            </Button>
          </div>

          {activeTab === 'single' && (
            <AccountScopeFilter api={api} scope={scope} onScopeChange={setScope} />
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Rafraîchir les données"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'compare' ? (
        <PortfolioComparator api={api} />
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">
            Extraction et calcul des métriques fondamentales...
          </p>
        </div>
      ) : error || !metrics ? (
        <div className="p-8 text-center bg-card border border-border rounded-xl">
          <p className="text-sm text-rose-500 font-medium">
            Erreur lors du chargement des métriques : {error?.message || 'Données introuvables'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Key Indicator Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Note Q Card */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Note Q Moyenne</span>
                <Award className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-500">
                  {metrics.general.qualityScore}
                </span>
                <span className="text-xs text-muted-foreground">/ 20</span>
              </div>
              <div className="mt-2 w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${(metrics.general.qualityScore / 20) * 100}%` }}
                />
              </div>
            </div>

            {/* ROIC Pondéré */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">ROIC Pondéré</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {metrics.returnsOnCapital.roic != null ? `${metrics.returnsOnCapital.roic.toFixed(1)}%` : '—'}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground mt-1">
                Rentabilité du capital investi
              </span>
            </div>

            {/* P/E sur coût */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">P/E sur coût (PRU)</span>
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-500">
                  {metrics.valuation.peOnCost != null ? metrics.valuation.peOnCost.toFixed(1) : '—'}
                </span>
                {metrics.valuation.peRatio != null && (
                  <span className="text-xs text-muted-foreground">
                    (actuel: {metrics.valuation.peRatio.toFixed(1)})
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground mt-1">
                Valorisation basée sur votre prix d'achat
              </span>
            </div>

            {/* Concentration Top 5 */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Concentration Top 5</span>
                <Percent className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {metrics.general.top5Concentration}%
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground mt-1">
                sur {metrics.general.stockCount} actions
              </span>
            </div>
          </div>

          {/* Core Visual Summary Card (Faithful replica of reference image) */}
          <MetricsSummaryCard
            metrics={metrics}
            title="Statistiques (Actions uniquement)"
            subtitle={`Périmètre : ${scope.label || (scope.type === 'all' ? 'Tous les comptes' : scope.id)}`}
          />

          {/* Holdings Detail Table */}
          <HoldingsMetricsTable
            holdings={metrics.holdings}
            baseCurrency={metrics.baseCurrency}
          />
        </div>
      )}
    </div>
  );
};
