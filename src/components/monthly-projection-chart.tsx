import React from 'react';
import type { MonthProjection } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@wealthfolio/ui';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { CalendarDays, Info } from 'lucide-react';

interface MonthlyProjectionChartProps {
  projections: MonthProjection[];
  baseCurrency: string;
  monthlyAverage: number;
  selectedMonthKey: string | null;
  onSelectMonth: (monthKey: string) => void;
}

export const MonthlyProjectionChart: React.FC<MonthlyProjectionChartProps> = ({
  projections,
  baseCurrency,
  monthlyAverage,
  selectedMonthKey,
  onSelectMonth,
}) => {
  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: baseCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const fullCurrencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: baseCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const chartData = projections.map((p) => ({
    key: p.key,
    month: p.shortMonthLabel,
    monthLabel: p.monthLabel,
    amount: p.totalAmountBase,
    payoutCount: p.payoutCount,
    isSelected: p.key === selectedMonthKey,
  }));

  const maxAmount = Math.max(...chartData.map((d) => d.amount), monthlyAverage, 10);
  const yAxisMax = Math.ceil((maxAmount * 1.15) / 10) * 10;

  return (
    <Card className="border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-semibold">12-Month Projected Income</CardTitle>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-xs bg-primary/80" /> Payout
          </span>
          <span className="flex items-center gap-1 ml-2">
            <span className="inline-block w-3 h-0.5 bg-amber-500/80 border-dashed" /> Monthly Avg ({currencyFormatter.format(monthlyAverage)})
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 opacity-70" />
          <span>Click on any month to inspect individual dividend sources.</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              onClick={(state: any) => {
                if (!state) return;
                const index = state.activeTooltipIndex;
                if (typeof index === 'number' && index >= 0 && chartData[index]) {
                  onSelectMonth(chartData[index].key);
                  return;
                }
                if (state.activePayload && state.activePayload.length > 0) {
                  const clickedKey = state.activePayload[0].payload.key;
                  if (clickedKey) onSelectMonth(clickedKey);
                }
              }}
            >
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground, #888)', cursor: 'pointer' }}
              />
              <YAxis
                domain={[0, yAxisMax]}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => currencyFormatter.format(val)}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground, #888)' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(120, 120, 120, 0.12)', radius: 4 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-popover p-2.5 shadow-md text-xs">
                        <div className="font-semibold text-popover-foreground mb-1">
                          {data.monthLabel}
                        </div>
                        <div className="flex items-center justify-between gap-4 text-muted-foreground">
                          <span>Projected:</span>
                          <span className="font-bold text-foreground">
                            {fullCurrencyFormatter.format(data.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-muted-foreground mt-0.5">
                          <span>Payers:</span>
                          <span className="font-medium text-foreground">
                            {data.payoutCount} {data.payoutCount === 1 ? 'asset' : 'assets'}
                          </span>
                        </div>
                        <div className="text-[10px] text-primary/90 font-medium mt-1.5 flex items-center gap-1">
                          <span>Click bar to inspect month details</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {monthlyAverage > 0 && (
                <ReferenceLine
                  y={monthlyAverage}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                />
              )}
              <Bar
                dataKey="amount"
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
                onClick={(entry: any) => {
                  if (entry && entry.key) {
                    onSelectMonth(entry.key);
                  }
                }}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={`cell-${entry.key}`}
                    onClick={() => onSelectMonth(entry.key)}
                    style={{ cursor: 'pointer' }}
                    fill={
                      entry.isSelected
                        ? 'var(--primary, #3b82f6)'
                        : entry.amount > 0
                        ? 'var(--primary, #3b82f6)'
                        : 'var(--muted, #e2e8f0)'
                    }
                    fillOpacity={entry.isSelected ? 1 : entry.amount > 0 ? 0.75 : 0.25}
                    stroke={entry.isSelected ? 'var(--primary, #3b82f6)' : 'transparent'}
                    strokeWidth={entry.isSelected ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
