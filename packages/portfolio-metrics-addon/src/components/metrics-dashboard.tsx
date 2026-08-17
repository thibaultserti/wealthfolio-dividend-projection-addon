import React, { useState } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';
import type { AccountScope } from '../types';
import { usePortfolioMetrics } from '../hooks/use-portfolio-metrics';
import { AccountScopeFilter } from './account-scope-filter';
import { MetricsSummaryCard } from './metrics-summary-card';
import { HoldingsMetricsTable } from './holdings-metrics-table';
import { PortfolioComparator } from './portfolio-comparator';
import { ImportDataModal } from './import-data-modal';
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
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface MetricsDashboardProps {
  api: HostAPI;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ api }) => {
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [scope, setScope] = useState<AccountScope>({
    type: 'all',
    label: 'All Portfolios',
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const {
    data: metrics,
    isLoading,
    isFetching,
    refetch,
    error,
  } = usePortfolioMetrics({
    api,
    scope,
  });

  const importedCount = (metrics as any)?.importedCount ?? 0;
  const lastImportedAt = (metrics as any)?.lastImportedAt;
  const portfolioTickers = (metrics as any)?.portfolioTickers ?? [];

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
            Analyse approfondie des marges, rentabilités sur capitaux, santé financière,
            valorisations et Note Q
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

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Rafraîchir les calculs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>

          {/* Import CSV Button */}
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs flex items-center gap-1.5 font-semibold"
            onClick={() => setIsImportModalOpen(true)}
            title="Importer les fondamentaux via fichier CSV"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Importer Fondamentaux (CSV)</span>
            {importedCount > 0 && (
              <Badge className="ml-1 bg-white/20 text-white text-[10px] h-4 px-1 rounded-full">
                {importedCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* No Imported Data Banner */}
      {metrics && importedCount === 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/20 text-primary rounded-xl shrink-0 mt-0.5">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">
                Importez les fondamentaux réels de vos actions
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Générez le fichier{' '}
                <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground font-semibold">
                  portfolio_fundamentals.csv
                </code>{' '}
                avec le script Python local et importez-le en 1 clic pour afficher les marges
                réelles, le ROIC, la dette et le P/E.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 text-xs font-semibold flex items-center gap-1.5"
            onClick={() => setIsImportModalOpen(true)}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Importer mon fichier CSV</span>
          </Button>
        </div>
      )}

      {/* Imported Data Info Banner */}
      {metrics && importedCount > 0 && lastImportedAt && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              <strong>{importedCount} actions</strong> avec états financiers réels importés.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] opacity-75">
              Dernière mise à jour : {formatDate(lastImportedAt)}
            </span>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="text-primary hover:underline font-semibold ml-1 text-xs"
            >
              Mettre à jour
            </button>
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Note Q Card */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Note Q Moyenne</span>
                <Award className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {metrics.general.qualityScore > 0 ? metrics.general.qualityScore : '—'}
                </span>
                {metrics.general.qualityScore > 0 && (
                  <span className="text-xs text-muted-foreground">/ 20</span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground mt-1">
                Score de qualité globale
              </span>
            </div>

            {/* ROIC Pondéré */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">ROIC Pondéré</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {metrics.returnsOnCapital.roic != null
                    ? `${metrics.returnsOnCapital.roic.toFixed(1)}%`
                    : '—'}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground mt-1">
                Rentabilité du capital investi
              </span>
            </div>

            {/* P/E sur coût */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  P/E sur coût (PRU)
                </span>
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
                <span className="text-xs text-muted-foreground font-medium">
                  Concentration Top 5
                </span>
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

            {/* Concentration Top 10 */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  Concentration Top 10
                </span>
                <PieChart className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {metrics.general.top10Concentration}%
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground mt-1">
                sur {metrics.general.stockCount} actions
              </span>
            </div>
          </div>

          {/* Core Visual Summary Card */}
          <MetricsSummaryCard
            metrics={metrics}
            title="Statistiques (Actions uniquement)"
            subtitle={`Périmètre : ${scope.label || (scope.type === 'all' ? 'Tous les comptes' : scope.id)}`}
          />

          {/* Holdings Detail Table with 5-tier colors and TickerLogos */}
          <HoldingsMetricsTable holdings={metrics.holdings} baseCurrency={metrics.baseCurrency} />
        </div>
      )}

      {/* Import CSV Modal */}
      <ImportDataModal
        api={api}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={() => refetch()}
        portfolioTickers={portfolioTickers}
      />
    </div>
  );
};
