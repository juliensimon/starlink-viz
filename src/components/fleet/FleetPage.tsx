'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SummaryStrip } from './SummaryStrip';
import { ConstellationGrowth } from './charts/ConstellationGrowth';
import { AltitudeDistribution } from './charts/AltitudeDistribution';
import { ShellFillRate } from './charts/ShellFillRate';
import { LaunchCadence } from './charts/LaunchCadence';
import { SatelliteLifecycle } from './charts/SatelliteLifecycle';
import { OrbitalPlanes } from './charts/OrbitalPlanes';
import { IslCoverage } from './charts/IslCoverage';

interface ShellData {
  shell_id: number;
  total_count: number;
  operational_count: number;
  raising_count: number;
  deorbiting_count: number;
  isl_operational_count: number;
}

interface ShellsResponse {
  shells: ShellData[];
  recordCount: number;
  lastIngest: string | null;
}

export function FleetPage() {
  const [shells, setShells] = useState<ShellData[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [lastIngest, setLastIngest] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/shells')
      .then((r) => r.json())
      .then((data: ShellsResponse) => {
        setShells(data.shells);
        setRecordCount(data.recordCount);
        setLastIngest(data.lastIngest);
      })
      .catch(() => {});
  }, []);

  const summary = shells.length > 0
    ? shells.reduce(
        (acc, s) => ({
          total: acc.total + s.total_count,
          operational: acc.operational + s.operational_count,
          islCapable: acc.islCapable + s.isl_operational_count,
          raising: acc.raising + s.raising_count,
          deorbiting: acc.deorbiting + s.deorbiting_count,
        }),
        { total: 0, operational: 0, islCapable: 0, raising: 0, deorbiting: 0 },
      )
    : null;

  return (
    <div style={{ background: '#0a0a0f', color: '#fff', minHeight: '100vh', padding: 16 }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold' }}>STARLINK FLEET</span>
          <Link
            href="/"
            style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
          >
            &larr; Back to Globe
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          {lastIngest && <span>Last Ingest: {new Date(lastIngest).toLocaleString()}</span>}
          <span>Records: {recordCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ marginBottom: 16 }}>
        <SummaryStrip data={summary} />
      </div>

      {/* Empty state */}
      {recordCount === 0 && (
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            padding: '40px 0',
          }}
        >
          No fleet data yet. Run <code style={{ color: '#60a5fa' }}>npm run ingest</code>
        </div>
      )}

      {/* Chart grid */}
      {recordCount > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ConstellationGrowth />
          <AltitudeDistribution />
          <ShellFillRate shells={shells} />
          <LaunchCadence />
          <SatelliteLifecycle />
          <OrbitalPlanes />
          <IslCoverage />
        </div>
      )}
    </div>
  );
}
