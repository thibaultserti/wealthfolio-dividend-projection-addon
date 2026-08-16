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

  // Color helper for percentages
  const getGrowthColor = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'default';
    return val >= 0 ? 'green' : 'red';
  };

  const getMarginColor = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'default';
    return val >= 10 ? 'green' : val > 0 ? 'amber' : 'red';
  };

  const getRoicColor = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'default';
    return val >= 12 ? 'green' : val > 0 ? 'amber' : 'red';
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
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
              progressPercent={(general.qualityScore / 20) * 100}
              progressColor={general.qualityScore >= 13 ? 'green' : general.qualityScore >= 8 ? 'amber' : 'red'}
            />
          </div>

          {/* Section: Retours sur capitaux */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Retours sur capitaux</h3>
            <StatMetricRow
              label="ROIC"
              value={fmtPercent(returnsOnCapital.roic)}
              valueColor={getRoicColor(returnsOnCapital.roic)}
              progressPercent={returnsOnCapital.roic ? (returnsOnCapital.roic / 40) * 100 : null}
              progressColor={returnsOnCapital.roic && returnsOnCapital.roic >= 15 ? 'green' : 'amber'}
            />
            <StatMetricRow
              label="ROCE"
              value={fmtPercent(returnsOnCapital.roce)}
              valueColor={getRoicColor(returnsOnCapital.roce)}
              progressPercent={returnsOnCapital.roce ? (returnsOnCapital.roce / 40) * 100 : null}
              progressColor={returnsOnCapital.roce && returnsOnCapital.roce >= 15 ? 'green' : 'amber'}
            />
            <StatMetricRow
              label="ROE"
              value={fmtPercent(returnsOnCapital.roe)}
              valueColor={getRoicColor(returnsOnCapital.roe)}
              progressPercent={returnsOnCapital.roe ? (returnsOnCapital.roe / 40) * 100 : null}
              progressColor={returnsOnCapital.roe && returnsOnCapital.roe >= 15 ? 'green' : 'amber'}
            />
          </div>

          {/* Section: Santé */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Santé</h3>
            <StatMetricRow
              label="Dette nette/EBITDA"
              value={health.netDebtToEbitda != null ? fmtPercent(health.netDebtToEbitda) : '—'}
              valueColor={health.netDebtToEbitda != null && health.netDebtToEbitda <= 1.5 ? 'green' : 'amber'}
              progressPercent={
                health.netDebtToEbitda != null
                  ? Math.max(0, 100 - health.netDebtToEbitda * 20)
                  : null
              }
              progressColor={health.netDebtToEbitda != null && health.netDebtToEbitda <= 2 ? 'green' : 'amber'}
            />
            <StatMetricRow
              label="Interests Coverage"
              value={health.interestCoverage != null ? fmtNum(health.interestCoverage, '', 2) : '—'}
              valueColor={health.interestCoverage != null && health.interestCoverage >= 10 ? 'green' : 'default'}
              progressPercent={health.interestCoverage ? Math.min(100, (health.interestCoverage / 50) * 100) : null}
              progressColor="green"
            />
            <StatMetricRow
              label="Goodwill/Assets"
              value={fmtPercent(health.goodwillToAssets)}
              valueColor={health.goodwillToAssets != null && health.goodwillToAssets <= 20 ? 'green' : 'default'}
              progressPercent={health.goodwillToAssets ? (health.goodwillToAssets / 50) * 100 : null}
              progressColor={health.goodwillToAssets && health.goodwillToAssets <= 25 ? 'green' : 'amber'}
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
              valueColor={getMarginColor(margins.grossMargin)}
              progressPercent={margins.grossMargin ? (margins.grossMargin / 80) * 100 : null}
              progressColor={margins.grossMargin && margins.grossMargin >= 40 ? 'green' : 'amber'}
            />
            <StatMetricRow
              label="Marge opérationnelle"
              value={fmtPercent(margins.operatingMargin)}
              valueColor={getMarginColor(margins.operatingMargin)}
              progressPercent={margins.operatingMargin ? (margins.operatingMargin / 50) * 100 : null}
              progressColor={margins.operatingMargin && margins.operatingMargin >= 20 ? 'green' : 'amber'}
            />
            <StatMetricRow
              label="Marge nette"
              value={fmtPercent(margins.netMargin)}
              valueColor={getMarginColor(margins.netMargin)}
              progressPercent={margins.netMargin ? (margins.netMargin / 50) * 100 : null}
              progressColor={margins.netMargin && margins.netMargin >= 15 ? 'green' : 'amber'}
            />
          </div>

          {/* Section: Croissance */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Croissance</h3>
            <StatMetricRow
              label="Croissance revenus"
              value={fmtPercent(growth.revenueGrowth)}
              valueColor={getGrowthColor(growth.revenueGrowth)}
              progressPercent={growth.revenueGrowth ? Math.max(0, (growth.revenueGrowth / 30) * 100) : null}
              progressColor={growth.revenueGrowth && growth.revenueGrowth >= 10 ? 'green' : 'amber'}
            />
            <StatMetricRow
              label="Croissance EPS"
              value={fmtPercent(growth.epsGrowth)}
              valueColor={getGrowthColor(growth.epsGrowth)}
              progressPercent={growth.epsGrowth ? Math.max(0, (growth.epsGrowth / 40) * 100) : null}
              progressColor={growth.epsGrowth && growth.epsGrowth >= 12 ? 'green' : 'amber'}
            />
            <StatMetricRow
              label="Croissance FCF"
              value={fmtPercent(growth.fcfGrowth)}
              valueColor={getGrowthColor(growth.fcfGrowth)}
              progressPercent={growth.fcfGrowth ? Math.max(0, (growth.fcfGrowth / 40) * 100) : null}
              progressColor={growth.fcfGrowth && growth.fcfGrowth >= 8 ? 'green' : 'red'}
            />
          </div>

          {/* Section: Valorisation */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground/90 mb-2.5">Valorisation</h3>
            <StatMetricRow label="P/E Ratio" value={fmtNum(valuation.peRatio, '', 2)} />
            <StatMetricRow
              label="P/E sur coût"
              value={fmtNum(valuation.peOnCost, '', 2)}
              valueColor={
                valuation.peOnCost && valuation.peRatio && valuation.peOnCost < valuation.peRatio
                  ? 'green'
                  : 'default'
              }
            />
            <StatMetricRow label="P/FCF Ratio" value={fmtNum(valuation.pfcfRatio, '', 2)} />
            <StatMetricRow
              label="P/FCF sur coût"
              value={fmtNum(valuation.pfcfOnCost, '', 2)}
              valueColor={
                valuation.pfcfOnCost && valuation.pfcfRatio && valuation.pfcfOnCost < valuation.pfcfRatio
                  ? 'green'
                  : 'default'
              }
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
