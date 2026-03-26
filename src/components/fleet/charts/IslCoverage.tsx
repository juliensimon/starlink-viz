'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { ChartPanel } from '../ChartPanel';
import { FleetTooltip } from '../FleetTooltip';

interface GrowthRow {
  date: string;
  shell_id: number;
  operational_count: number;
  isl_operational_count: number;
}

interface ChartPoint {
  date: string;
  pct: number;
}

export function IslCoverage() {
  const [raw, setRaw] = useState<GrowthRow[]>([]);

  useEffect(() => {
    fetch('/api/fleet/growth')
      .then((r) => r.json())
      .then(setRaw)
      .catch(() => {});
  }, []);

  const data = useMemo(() => {
    if (raw.length === 0) return [];

    // Aggregate across all shells per date
    const byDate = new Map<string, { isl: number; ops: number }>();
    for (const row of raw) {
      const existing = byDate.get(row.date) || { isl: 0, ops: 0 };
      existing.isl += row.isl_operational_count;
      existing.ops += row.operational_count;
      byDate.set(row.date, existing);
    }

    return Array.from(byDate.entries())
      .filter(([, { isl }]) => isl > 0) // Only show dates where ISL sats exist
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { isl, ops }]): ChartPoint => ({
        date,
        pct: ops > 0 ? Math.round((isl / ops) * 1000) / 10 : 0,
      }));
  }, [raw]);

  return (
    <ChartPanel
      title="ISL Coverage"
      subtitle="% of operational fleet with laser inter-satellite link capability"
      footnote="ISL heuristic: all shells from 2022+, 43° from 2023, 33° from 2024. Shown from Sep 2021 (first v1.5 launch)."
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
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<FleetTooltip />} />
          <ReferenceLine
            y={50}
            stroke="rgba(74,222,128,0.15)"
            strokeDasharray="6 4"
            label={{
              value: '50%',
              position: 'right',
              style: { fontSize: 9, fill: 'rgba(74,222,128,0.4)', fontFamily: 'monospace' },
            }}
          />
          <Area
            type="monotone"
            dataKey="pct"
            name="ISL Coverage"
            stroke="#4ade80"
            fill="rgba(74,222,128,0.08)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
