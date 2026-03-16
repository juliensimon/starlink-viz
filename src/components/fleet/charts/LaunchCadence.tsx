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

type Grouping = 'monthly' | 'quarterly';

interface RawRow {
  date: string;
  new_launches: number;
}

interface GroupedRow {
  period: string;
  launches: number;
}

function toMonthKey(date: string): string {
  return date.slice(0, 7); // "2024-01"
}

function toQuarterKey(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const month = parseInt(monthStr, 10);
  const quarter = Math.ceil(month / 3);
  const shortYear = yearStr.slice(2);
  return `Q${quarter}'${shortYear}`;
}

function groupData(rows: RawRow[], grouping: Grouping): GroupedRow[] {
  const groups = new Map<string, number>();
  const keyFn = grouping === 'monthly' ? toMonthKey : toQuarterKey;

  for (const row of rows) {
    const key = keyFn(row.date);
    groups.set(key, (groups.get(key) || 0) + row.new_launches);
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, launches]) => ({ period, launches }));
}

export function LaunchCadence() {
  const [grouping, setGrouping] = useState<Grouping>('monthly');
  const [raw, setRaw] = useState<RawRow[]>([]);

  useEffect(() => {
    fetch('/api/fleet/launches')
      .then((r) => r.json())
      .then(setRaw)
      .catch(() => {});
  }, []);

  const data = useMemo(() => groupData(raw, grouping), [raw, grouping]);

  const controls = (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['monthly', 'quarterly'] as Grouping[]).map((g) => (
        <button
          key={g}
          onClick={() => setGrouping(g)}
          style={{
            fontFamily: 'monospace',
            fontSize: 9,
            padding: '2px 8px',
            border: '1px solid',
            borderColor: grouping === g ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
            borderRadius: 3,
            background: grouping === g ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: grouping === g ? '#fff' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {g}
        </button>
      ))}
    </div>
  );

  return (
    <ChartPanel
      title="Launch Cadence"
      subtitle="New satellites first seen in TLE data, grouped by period"
      footnote="&quot;First seen&quot; uses the earliest TLE epoch per NORAD ID — actual launch dates may differ by 1-2 days."
      controls={controls}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="period"
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
          <Bar dataKey="launches" fill="#60a5fa" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
