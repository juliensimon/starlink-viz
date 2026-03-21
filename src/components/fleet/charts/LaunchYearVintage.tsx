'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartPanel } from '../ChartPanel';
import { FleetTooltip } from '../FleetTooltip';

const STATUS_COLORS: Record<string, string> = {
  operational: '#4ade80',
  raising: '#fbbf24',
  deorbiting: '#fb923c',
  unknown: '#94a3b8',
  decayed: '#f87171',
  anomalous: '#e879f9',
};

const STATUSES = ['operational', 'raising', 'deorbiting', 'unknown', 'decayed', 'anomalous'];

interface RawRow {
  launch_year: number;
  status: string;
  count: number;
}

interface PivotedRow {
  year: string;
  operational: number;
  raising: number;
  deorbiting: number;
  unknown: number;
  decayed: number;
  anomalous: number;
}

function pivotData(rows: RawRow[]): PivotedRow[] {
  const byYear = new Map<number, PivotedRow>();

  for (const row of rows) {
    if (!byYear.has(row.launch_year)) {
      byYear.set(row.launch_year, {
        year: String(row.launch_year),
        operational: 0,
        raising: 0,
        deorbiting: 0,
        unknown: 0,
        decayed: 0,
        anomalous: 0,
      });
    }
    const entry = byYear.get(row.launch_year)!;
    if (row.status in entry) {
      (entry as unknown as Record<string, number>)[row.status] = row.count;
    }
  }

  return Array.from(byYear.values()).sort((a, b) => a.year.localeCompare(b.year));
}

export function LaunchYearVintage() {
  const [raw, setRaw] = useState<RawRow[]>([]);

  useEffect(() => {
    fetch('/api/fleet/vintage')
      .then((r) => r.json())
      .then(setRaw)
      .catch(() => {});
  }, []);

  const data = useMemo(() => pivotData(raw), [raw]);

  return (
    <ChartPanel
      title="Launch Year Vintage"
      subtitle="Satellites grouped by launch year, colored by current status"
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<FleetTooltip />} />
          {STATUSES.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="vintage"
              fill={STATUS_COLORS[status]}
              fillOpacity={0.7}
              radius={0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
