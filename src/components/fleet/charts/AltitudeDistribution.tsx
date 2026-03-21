'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartPanel } from '../ChartPanel';
import { FleetTooltip } from '../FleetTooltip';
import { SHELL_COLORS } from '../shell-colors';

interface RawRow {
  altitude_km: number;
  shell_id: number;
}

interface BinRow {
  bin: string;
  count: number;
  shellId: number;
}

const BIN_SIZE = 10;

function binData(rows: RawRow[]): BinRow[] {
  const bins = new Map<number, Map<number, number>>();

  for (const row of rows) {
    const binFloor = Math.floor(row.altitude_km / BIN_SIZE) * BIN_SIZE;
    if (!bins.has(binFloor)) bins.set(binFloor, new Map());
    const shellCounts = bins.get(binFloor)!;
    shellCounts.set(row.shell_id, (shellCounts.get(row.shell_id) || 0) + 1);
  }

  const result: BinRow[] = [];
  const sortedBins = Array.from(bins.keys()).sort((a, b) => a - b);

  for (const binFloor of sortedBins) {
    const shellCounts = bins.get(binFloor)!;
    let total = 0;
    let dominantShell = 0;
    let maxCount = 0;

    for (const [shellId, count] of shellCounts) {
      total += count;
      if (count > maxCount) {
        maxCount = count;
        dominantShell = shellId;
      }
    }

    result.push({
      bin: `${binFloor}`,
      count: total,
      shellId: dominantShell,
    });
  }

  return result;
}

export function AltitudeDistribution() {
  const [raw, setRaw] = useState<RawRow[]>([]);

  useEffect(() => {
    fetch('/api/fleet/altitudes')
      .then((r) => r.json())
      .then(setRaw)
      .catch(() => {});
  }, []);

  const data = useMemo(() => binData(raw), [raw]);

  return (
    <ChartPanel
      title="Altitude Distribution"
      subtitle="Current snapshot — satellites binned by altitude (10 km bins)"
      footnote="Gaps between clusters indicate orbit-raising corridors. Sub-400 km objects are typically deorbiting."
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'km',
              position: 'insideBottomRight',
              offset: -2,
              style: { fontSize: 8, fill: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' },
            }}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<FleetTooltip />} />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={SHELL_COLORS[entry.shellId]?.color ?? '#888'} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
