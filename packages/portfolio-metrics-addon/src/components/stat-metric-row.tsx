import React from 'react';

interface StatMetricRowProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  progressPercent?: number | null; // 0 to 100
  progressColor?: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'slate';
  valueColor?: 'green' | 'amber' | 'red' | 'default';
  isScore?: boolean;
  scoreMax?: number;
}

export const StatMetricRow: React.FC<StatMetricRowProps> = ({
  label,
  value,
  unit = '',
  progressPercent,
  progressColor = 'green',
  valueColor = 'default',
  isScore = false,
  scoreMax = 20,
}) => {
  const displayValue =
    value === null || value === undefined || (typeof value === 'number' && isNaN(value))
      ? '—'
      : `${value}${unit}`;

  // Determine text color
  let textColorClass = 'text-foreground font-semibold';
  if (valueColor === 'green') textColorClass = 'text-emerald-500 dark:text-emerald-400 font-semibold';
  else if (valueColor === 'red') textColorClass = 'text-rose-500 dark:text-rose-400 font-semibold';
  else if (valueColor === 'amber') textColorClass = 'text-amber-500 dark:text-amber-400 font-semibold';

  // Determine progress bar fill color
  let barColorClass = 'bg-emerald-500 dark:bg-emerald-400';
  if (progressColor === 'red') barColorClass = 'bg-rose-500 dark:bg-rose-400';
  else if (progressColor === 'amber') barColorClass = 'bg-amber-500 dark:bg-amber-400';
  else if (progressColor === 'blue') barColorClass = 'bg-blue-500 dark:bg-blue-400';
  else if (progressColor === 'slate') barColorClass = 'bg-slate-500';

  const showBar = progressPercent !== null && progressPercent !== undefined;
  const clampedPercent = showBar ? Math.min(100, Math.max(0, progressPercent || 0)) : 0;

  return (
    <div className="flex items-center justify-between py-1.5 text-xs sm:text-sm">
      <span className="text-muted-foreground font-normal truncate mr-2">{label}:</span>

      <div className="flex items-center gap-3 ml-auto flex-shrink-0">
        <span className={`text-right ${textColorClass}`}>
          {isScore && typeof value === 'number' ? (
            <span className="text-emerald-500 font-bold">{value}</span>
          ) : (
            displayValue
          )}
        </span>

        {showBar && (
          <div className="w-14 sm:w-16 h-2.5 bg-muted/60 dark:bg-neutral-800 rounded-sm overflow-hidden flex items-center">
            <div
              className={`h-full ${barColorClass} transition-all duration-500 rounded-sm`}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
