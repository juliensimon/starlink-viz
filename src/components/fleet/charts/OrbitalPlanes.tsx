'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartPanel } from '../ChartPanel';
import { FleetTooltip } from '../FleetTooltip';
import { SHELL_COLORS } from '../shell-colors';
import { correctRAANToEpoch } from '@/lib/fleet/raan-correction';

interface PlaneRow {
  raan: number;
  altitude_km: number;
  mean_motion: number;
  inclination: number;
  epoch_ts: number;
}

interface ScatterPoint {
  raan: number;
  altDev: number;
}

// Shell tab order: 53°, 70°, 43°, 97.6°, 33°
const SHELL_ORDER = [2, 3, 1, 4, 0];

function getReferenceEpoch(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return midnight.getTime() / 1000;
}

export function OrbitalPlanes() {
  const [shellId, setShellId] = useState(2);
  const [raw, setRaw] = useState<PlaneRow[]>([]);

  useEffect(() => {
    fetch(`/api/fleet/planes?shell=${shellId}`)
      .then((r) => r.json())
      .then(setRaw)
      .catch(() => {});
  }, [shellId]);

  const data = useMemo(() => {
    if (raw.length === 0) return [];

    const refEpoch = getReferenceEpoch();

    // Compute mean altitude for deviation
    const meanAlt = raw.reduce((sum, r) => sum + r.altitude_km, 0) / raw.length;

    return raw.map((r): ScatterPoint => {
      const correctedRaan = correctRAANToEpoch({
        raanDeg: r.raan,
        inclination: r.inclination,
        meanMotion: r.mean_motion,
        deltaSeconds: refEpoch - r.epoch_ts,
      });

      return {
        raan: Math.round(correctedRaan * 100) / 100,
        altDev: Math.round((r.altitude_km - meanAlt) * 100) / 100,
      };
    });
  }, [raw]);

  const controls = (
    <div style={{ display: 'flex', gap: 4 }}>
      {SHELL_ORDER.map((id) => (
        <button
          key={id}
          onClick={() => setShellId(id)}
          style={{
            fontFamily: 'monospace',
            fontSize: 9,
            padding: '2px 8px',
            border: '1px solid',
            borderColor: shellId === id ? SHELL_COLORS[id].color : 'rgba(255,255,255,0.1)',
            borderRadius: 3,
            background: shellId === id ? SHELL_COLORS[id].bg : 'transparent',
            color: shellId === id ? SHELL_COLORS[id].color : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
          }}
        >
          {SHELL_COLORS[id].label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartPanel
      title="Orbital Planes — RAAN Distribution"
      subtitle="Right ascension of ascending node, showing even spacing of orbital planes"
      footnote="RAAN values corrected for J2 nodal precession to a common reference epoch (most recent midnight UTC)"
      controls={controls}
    >
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="raan"
            type="number"
            domain={[0, 360]}
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            name="RAAN"
            unit="°"
          />
          <YAxis
            dataKey="altDev"
            type="number"
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            name="Alt deviation"
            unit=" km"
          />
          <Tooltip content={<FleetTooltip />} />
          <Scatter
            data={data}
            fill={SHELL_COLORS[shellId].color}
            fillOpacity={0.6}
            r={2.5}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
