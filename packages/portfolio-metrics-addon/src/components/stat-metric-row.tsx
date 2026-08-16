import React from 'react';

interface StatMetricRowProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  isScore?: boolean;
}

export const StatMetricRow: React.FC<StatMetricRowProps> = ({
  label,
  value,
  unit = '',
  isScore = false,
}) => {
  const displayValue =
    value === null || value === undefined || (typeof value === 'number' && isNaN(value))
      ? '—'
      : `${value}${unit}`;

  return (
    <div className="flex items-center justify-between py-1.5 text-xs sm:text-sm gap-2 min-w-0">
      <span className="text-muted-foreground font-normal truncate">{label}:</span>

      <div className="flex items-center justify-end flex-shrink-0">
        <span className="text-right font-medium text-foreground">
          {isScore && typeof value === 'number' ? (
            <span className="font-bold text-foreground">{value}</span>
          ) : (
            displayValue
          )}
        </span>
      </div>
    </div>
  );
};
