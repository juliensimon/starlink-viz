'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { ChartPanel } from '../ChartPanel';
import { FleetTooltip } from '../FleetTooltip';

interface AltitudeRow {
  norad_id: number;
  status: string;
  altitude_km: number;
}

interface HistoryRow {
  norad_id: number;
  epoch_ts: number;
  altitude_km: number;
  status: string;
}

interface SampleSat {
  noradId: number;
  status: string;
  color: string;
}

interface DataPoint {
  day: number;
  [key: string]: number | undefined;
}

function statusColor(status: string): string {
  if (status === 'raising') return '#4ade80';
  if (status === 'deorbiting') return '#f87171';
  return '#60a5fa';
}

export function SatelliteLifecycle() {
  const [samples, setSamples] = useState<SampleSat[]>([]);
  const [histories, setHistories] = useState<Map<number, HistoryRow[]>>(new Map());

  // Step 1: fetch altitudes to find sample satellites
  useEffect(() => {
    fetch('/api/fleet/altitudes')
      .then((r) => r.json())
      .then((rows: AltitudeRow[]) => {
        const raising = rows.filter((r) => r.status === 'raising').slice(0, 3);
        const deorbiting = rows.filter((r) => r.status === 'deorbiting').slice(0, 2);
        const picked = [...raising, ...deorbiting];
        setSamples(
          picked.map((r) => ({
            noradId: r.norad_id,
            status: r.status,
            color: statusColor(r.status),
          }))
        );
      })
      .catch(() => {});
  }, []);

  // Step 2: fetch history for each sample satellite
  useEffect(() => {
    if (samples.length === 0) return;
    const map = new Map<number, HistoryRow[]>();
    Promise.all(
      samples.map((s) =>
        fetch(`/api/fleet/satellite/${s.noradId}`)
          .then((r) => r.json())
          .then((rows: HistoryRow[]) => {
            map.set(s.noradId, rows);
          })
          .catch(() => {})
      )
    ).then(() => setHistories(new Map(map)));
  }, [samples]);

  const data = useMemo(() => {
    if (histories.size === 0) return [];

    // Build a unified array keyed by day-since-first-observation
    const allDays = new Set<number>();
    const satDays = new Map<number, Map<number, number>>();

    for (const [noradId, rows] of histories) {
      if (!rows || rows.length === 0) continue;
      const firstTs = rows[0].epoch_ts;
      const dayMap = new Map<number, number>();
      for (const row of rows) {
        const day = Math.round((row.epoch_ts - firstTs) / 86400);
        dayMap.set(day, row.altitude_km);
        allDays.add(day);
      }
      satDays.set(noradId, dayMap);
    }

    const sortedDays = Array.from(allDays).sort((a, b) => a - b);
    return sortedDays.map((day) => {
      const point: DataPoint = { day };
      for (const [noradId, dayMap] of satDays) {
        const alt = dayMap.get(day);
        if (alt !== undefined) {
          point[`sat_${noradId}`] = Math.round(alt * 10) / 10;
        }
      }
      return point;
    });
  }, [histories]);

  return (
    <ChartPanel
      title="Satellite Lifecycle"
      subtitle="Altitude over time for individual satellites — orbit raising → operational → deorbit"
      footnote="Shaded band shows operational altitude range (460–570 km). Each line is one satellite."
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'Days since first observation',
              position: 'insideBottom',
              offset: -2,
              style: { fontSize: 8, fill: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' },
            }}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
            label={{
              value: 'Altitude (km)',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: { fontSize: 8, fill: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' },
            }}
          />
          <Tooltip content={<FleetTooltip />} />
          <ReferenceArea
            y1={460}
            y2={570}
            fill="rgba(96,165,250,0.06)"
            strokeOpacity={0}
          />
          {samples.map((s) => (
            <Line
              key={s.noradId}
              type="monotone"
              dataKey={`sat_${s.noradId}`}
              name={`NORAD ${s.noradId}`}
              stroke={s.color}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
