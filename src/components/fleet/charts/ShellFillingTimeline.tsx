'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartPanel } from '../ChartPanel';
import { FleetTooltip } from '../FleetTooltip';
import { SHELL_COLORS } from '../shell-colors';
import { SHELL_TARGETS } from '@/lib/config';

interface RawRow {
  date: string;
  shell_id: number;
  operational_count: number;
}

interface PivotedRow {
  date: string;
  [shellLabel: string]: string | number;
}

const SHELL_ORDER = [2, 3, 1, 4, 0];

function pivotData(rows: RawRow[]): PivotedRow[] {
  const byDate = new Map<string, PivotedRow>();

  for (const row of rows) {
    const dateStr = row.date.slice(0, 10);
    if (!byDate.has(dateStr)) {
      const entry: PivotedRow = { date: dateStr };
      for (let i = 0; i < 5; i++) entry[SHELL_COLORS[i].label] = 0;
      byDate.set(dateStr, entry);
    }
    const entry = byDate.get(dateStr)!;
    const label = SHELL_COLORS[row.shell_id]?.label;
    if (label) {
      const target = SHELL_TARGETS[row.shell_id]?.target || 1;
      entry[label] = Math.round((row.operational_count / target) * 1000) / 10; // percentage with 1 decimal
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function ShellFillingTimeline() {
  const [raw, setRaw] = useState<RawRow[]>([]);

  useEffect(() => {
    fetch('/api/fleet/growth')
      .then((r) => r.json())
      .then(setRaw)
      .catch(() => {});
  }, []);

  const data = useMemo(() => pivotData(raw), [raw]);

  return (
    <ChartPanel
      title="Shell Filling Over Time"
      subtitle="Operational satellites as % of FCC-authorized target per shell"
      footnote="Gap in data: Apr 2021 – Jan 2026 (Space-Track backfill in progress)"
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
            tickFormatter={(d: string) => {
              const date = new Date(d);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, 'auto']}
          />
          <ReferenceLine y={100} stroke="rgba(255,255,255,0.2)" strokeDasharray="6 4" label={{ value: '100% target', fill: 'rgba(255,255,255,0.3)', fontSize: 9, position: 'right' }} />
          <Tooltip content={<FleetTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />} />
          {SHELL_ORDER.map((id) => (
            <Line
              key={id}
              type="monotone"
              dataKey={SHELL_COLORS[id].label}
              stroke={SHELL_COLORS[id].color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
