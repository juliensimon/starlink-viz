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
import { LaunchYearVintage } from './charts/LaunchYearVintage';
import { ShellFillingTimeline } from './charts/ShellFillingTimeline';

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

interface KpiData {
  total: number;
  operational: number;
  islCapable: number;
  raising: number;
  deorbiting: number;
  decayed: number;
  launched2026: number;
}

export function FleetPage() {
  const [shells, setShells] = useState<ShellData[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [lastIngest, setLastIngest] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/fleet/shells')
      .then((r) => r.json())
      .then((data: ShellsResponse) => {
        setShells(data.shells);
        setRecordCount(data.recordCount);
        setLastIngest(data.lastIngest);
      })
      .catch(() => {});

    fetch('/api/fleet/kpis')
      .then((r) => r.json())
      .then((data: KpiData) => {
        if (data.total) setKpis(data);
      })
      .catch(() => {});
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshMsg('Downloading from HF...');
    fetch('/api/fleet/refresh', { method: 'POST' })
      .then((r) => r.json())
      .then((data: { ok: boolean; message: string }) => {
        if (data.ok) {
          setRefreshMsg('Reloading charts...');
          setRefreshKey((k) => k + 1);
          setTimeout(() => setRefreshMsg(''), 2000);
        } else {
          setRefreshMsg(`Failed: ${data.message}`);
          setTimeout(() => setRefreshMsg(''), 5000);
        }
      })
      .catch(() => {
        setRefreshMsg('Network error');
        setTimeout(() => setRefreshMsg(''), 5000);
      })
      .finally(() => setRefreshing(false));
  };

  // Fallback KPIs from shell data if /api/fleet/kpis hasn't loaded yet
  const summaryData = kpis || (shells.length > 0
    ? shells.reduce(
        (acc, s) => ({
          total: acc.total + s.total_count,
          operational: acc.operational + s.operational_count,
          islCapable: acc.islCapable + s.isl_operational_count,
          raising: acc.raising + s.raising_count,
          deorbiting: acc.deorbiting + s.deorbiting_count,
          decayed: 0,
          launched2026: 0,
        }),
        { total: 0, operational: 0, islCapable: 0, raising: 0, deorbiting: 0, decayed: 0, launched2026: 0 },
      )
    : null);

  return (
    <div style={{ background: '#0a0a0f', color: '#fff', minHeight: '100vh', padding: 16, overflow: 'auto', height: '100vh' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          {lastIngest && <span>Last: {new Date(lastIngest).toLocaleDateString()}</span>}
          <span>{recordCount.toLocaleString()} days</span>
          {refreshMsg && (
            <span style={{ color: refreshMsg.startsWith('Failed') ? '#f87171' : '#fbbf24', fontSize: 10 }}>
              {refreshMsg}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              fontFamily: 'monospace',
              fontSize: 10,
              color: refreshing ? 'rgba(255,255,255,0.3)' : '#60a5fa',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: refreshing ? 'wait' : 'pointer',
            }}
          >
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ marginBottom: 16 }}>
        <SummaryStrip data={summaryData} />
      </div>

      {/* Charts */}
      {recordCount > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          {/* Row 1: Growth (wide) + Shell Fill (narrow) */}
          <ConstellationGrowth />
          <ShellFillRate shells={shells} />

          {/* Row 2: Shell Filling Timeline (wide) + ISL Coverage */}
          <ShellFillingTimeline />
          <IslCoverage />

          {/* Row 3: Altitude + Launch Year Vintage */}
          <AltitudeDistribution />
          <LaunchYearVintage />

          {/* Row 4: Launch Cadence + Orbital Planes */}
          <LaunchCadence />
          <OrbitalPlanes />

          {/* Row 5: Satellite Lifecycle (full width) */}
          <div style={{ gridColumn: '1 / -1' }}>
            <SatelliteLifecycle />
          </div>
        </div>
      )}

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
          No fleet data. Click Refresh to download from HF dataset.
        </div>
      )}
    </div>
  );
}
