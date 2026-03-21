'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartPanel } from '../ChartPanel';
import { FleetTooltip } from '../FleetTooltip';
import { SHELL_COLORS } from '../shell-colors';

type TimeRange = '3M' | '1Y' | 'ALL';

interface RawRow {
  date: string;
  shell_id: number;
  operational_count: number;
}

interface PivotedRow {
  date: string;
  [shellLabel: string]: string | number;
}

function getFromDate(range: TimeRange): string | undefined {
  if (range === 'ALL') return undefined;
  const d = new Date();
  if (range === '3M') d.setMonth(d.getMonth() - 3);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function pivotData(rows: RawRow[]): PivotedRow[] {
  const byDate = new Map<string, PivotedRow>();

  for (const row of rows) {
    if (!byDate.has(row.date)) {
      const entry: PivotedRow = { date: row.date };
      for (let i = 0; i < 5; i++) entry[SHELL_COLORS[i].label] = 0;
      byDate.set(row.date, entry);
    }
    const entry = byDate.get(row.date)!;
    const label = SHELL_COLORS[row.shell_id]?.label;
    if (label) entry[label] = row.operational_count;
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function ConstellationGrowth() {
  const [range, setRange] = useState<TimeRange>('ALL');
  const [raw, setRaw] = useState<RawRow[]>([]);

  useEffect(() => {
    const from = getFromDate(range);
    const url = from ? `/api/fleet/growth?from=${from}` : '/api/fleet/growth';
    fetch(url)
      .then((r) => r.json())
      .then(setRaw)
      .catch(() => {});
  }, [range]);

  const data = useMemo(() => pivotData(raw), [raw]);

  // Shell order bottom-to-top: 53°, 70°, 43°, 97.6°, 33°
  const shellOrder = [2, 3, 1, 4, 0];

  const controls = (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['3M', '1Y', 'ALL'] as TimeRange[]).map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          style={{
            fontFamily: 'monospace',
            fontSize: 9,
            padding: '2px 8px',
            border: '1px solid',
            borderColor: range === r ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
            borderRadius: 3,
            background: range === r ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: range === r ? '#fff' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <ChartPanel
      title="Constellation Growth"
      subtitle="Total operational satellites over time, stacked by orbital shell"
      fullWidth
      controls={controls}
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip content={<FleetTooltip />} />
          {shellOrder.map((id) => (
            <Area
              key={id}
              type="monotone"
              dataKey={SHELL_COLORS[id].label}
              stackId="1"
              stroke={SHELL_COLORS[id].color}
              fill={SHELL_COLORS[id].bg}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
