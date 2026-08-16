import React from 'react';
import type { PortfolioAggregatedMetrics } from '../types';
import { StatMetricRow } from './stat-metric-row';

interface MetricsSummaryCardProps {
  metrics: PortfolioAggregatedMetrics;
  title?: string;
  subtitle?: string;
}

export const MetricsSummaryCard: React.FC<MetricsSummaryCardProps> = ({
  metrics,
  title = 'Statistiques (Actions uniquement)',
  subtitle,
}) => {
  const { general, margins, returnsOnCapital, growth, health, valuation } = metrics;

  // Format Helpers
  const fmtNum = (val: number | null | undefined, suffix = '', decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return `${val.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  };

  const fmtPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return `${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 gap-2 mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
            {general.stockCount} {general.stockCount > 1 ? 'positions actions' : 'position action'}
          </span>
          {metrics.nonStockHoldingsCount > 0 && (
            <span className="text-xs text-muted-foreground">
              (+{metrics.nonStockHoldingsCount} ETF/Fonds exclus)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14">
        {/* Left Column: Général, Retours sur capitaux, Santé */}
        <div className="space-y-6">
          {/* Section: Général */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5 flex items-center gap-2">
              <span>Général</span>
            </h3>
            <StatMetricRow label="Nombre d'actions" value={general.stockCount} />
            <StatMetricRow
              label="Top 5 du portefeuille"
              value={fmtNum(general.top5Concentration, ' %', general.top5Concentration % 1 === 0 ? 0 : 2)}
            />
            <StatMetricRow
              label="Market Cap"
              value={fmtNum(general.weightedMarketCap, ' M$')}
            />
            <StatMetricRow
              label="Note Q"
              value={general.qualityScore}
              isScore={true}
            />
          </div>

          {/* Section: Retours sur capitaux */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Retours sur capitaux</h3>
            <StatMetricRow
              label="ROIC"
              value={fmtPercent(returnsOnCapital.roic)}
            />
            <StatMetricRow
              label="ROCE"
              value={fmtPercent(returnsOnCapital.roce)}
            />
            <StatMetricRow
              label="ROE"
              value={fmtPercent(returnsOnCapital.roe)}
            />
          </div>

          {/* Section: Santé */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Santé</h3>
            <StatMetricRow
              label="Dette nette/EBITDA"
              value={health.netDebtToEbitda != null ? fmtPercent(health.netDebtToEbitda) : '—'}
            />
            <StatMetricRow
              label="Interests Coverage"
              value={health.interestCoverage != null ? fmtNum(health.interestCoverage, '', 2) : '—'}
            />
            <StatMetricRow
              label="Goodwill/Assets"
              value={fmtPercent(health.goodwillToAssets)}
            />
          </div>
        </div>

        {/* Right Column: Marges, Croissance, Valorisation */}
        <div className="space-y-6">
          {/* Section: Marges */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Marges</h3>
            <StatMetricRow
              label="Marge brute"
              value={fmtPercent(margins.grossMargin)}
            />
            <StatMetricRow
              label="Marge opérationnelle"
              value={fmtPercent(margins.operatingMargin)}
            />
            <StatMetricRow
              label="Marge nette"
              value={fmtPercent(margins.netMargin)}
            />
          </div>

          {/* Section: Croissance */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Croissance</h3>
            <StatMetricRow
              label="Croissance revenus"
              value={fmtPercent(growth.revenueGrowth)}
            />
            <StatMetricRow
              label="Croissance EPS"
              value={fmtPercent(growth.epsGrowth)}
            />
            <StatMetricRow
              label="Croissance FCF"
              value={fmtPercent(growth.fcfGrowth)}
            />
          </div>

          {/* Section: Valorisation */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Valorisation</h3>
            <StatMetricRow label="P/E Ratio (Actuel)" value={fmtNum(valuation.peRatio, '', 2)} />
            <StatMetricRow label="Forward P/E" value={fmtNum(valuation.forwardPE, '', 2)} />
            <StatMetricRow
              label="PEG Ratio"
              value={fmtNum(valuation.pegRatio, '', 2)}
            />
            <StatMetricRow
              label="P/E sur coût"
              value={fmtNum(valuation.peOnCost, '', 2)}
            />
            <StatMetricRow label="P/FCF Ratio" value={fmtNum(valuation.pfcfRatio, '', 2)} />
            <StatMetricRow
              label="P/FCF sur coût"
              value={fmtNum(valuation.pfcfOnCost, '', 2)}
            />
            {valuation.evToEbitda != null && (
              <StatMetricRow label="EV/EBITDA" value={fmtNum(valuation.evToEbitda, '', 2)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
