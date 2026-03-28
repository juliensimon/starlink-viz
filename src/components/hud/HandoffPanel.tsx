'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useHandoff } from '@/hooks/useHandoff';
import { useAppStore } from '@/stores/app-store';
import { getFullCatalog } from '@/lib/satellites/satellite-store';
import { GROUND_STATIONS } from '@/lib/satellites/ground-stations';
import { isOperationalAltitude } from '@/lib/config';

interface YearBreakdown {
  year: number;
  operational: number;
  total: number;
}

interface ShellStats {
  label: string;
  color: string;
  total: number;
  operational: number;
  years: YearBreakdown[];
}

// Ascending inclination order for display
const SHELLS = [
  { label: '33°', color: '#eecc22' },
  { label: '43°', color: '#ff8844' },
  { label: '53°', color: '#6699ff' },
  { label: '70°', color: '#22ddbb' },
  { label: '97.6°', color: '#ff4466' },
];

// Classify inclination into a shell index (matches SHELLS array order above)
function shellIndex(inc: number): number {
  if (inc >= 80) return 4;  // 97.6°
  if (inc >= 60) return 3;  // 70°
  if (inc >= 48) return 2;  // 53°
  if (inc >= 38) return 1;  // 43°
  return 0;                 // 33°
}

function getGSCounts() {
  const gateways = GROUND_STATIONS.filter((gs) => gs.type !== 'pop');
  const operational = gateways.filter((gs) => gs.status !== 'planned').length;
  const planned = gateways.filter((gs) => gs.status === 'planned').length;
  const pops = GROUND_STATIONS.filter((gs) => gs.type === 'pop').length;
  return { operational, planned, pops };
}

function formatTleAge(timestamp: number | null): string {
  if (timestamp === null) return 'n/a';
  const ageMs = Date.now() - timestamp;
  const ageSec = Math.floor(ageMs / 1000);
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  if (ageMin < 60) return `${ageMin}m ago`;
  const ageHr = Math.floor(ageMin / 60);
  if (ageHr < 24) return `${ageHr}h ago`;
  return 'stale';
}

export default function HandoffPanel() {
  const { isHandingOff, handoffProgress } = useHandoff();
  const [handoffCount, setHandoffCount] = useState(0);
  const [lastHandoffTime, setLastHandoffTime] = useState<number | null>(null);
  const wasHandingOffRef = useRef(false);
  const seenSatellitesRef = useRef(new Set<number>());
  const [uniqueSatCount, setUniqueSatCount] = useState(0);
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const demoMode = useAppStore((s) => s.demoMode);
  const tleLastFetched = useAppStore((s) => s.tleLastFetched);
  const wsConnected = useAppStore((s) => s.wsConnected);

  // Track unique satellites seen
  useEffect(() => {
    if (connectedSatelliteIndex !== null) {
      seenSatellitesRef.current.add(connectedSatelliteIndex);
      setUniqueSatCount(seenSatellitesRef.current.size);
    }
  }, [connectedSatelliteIndex]);

  // Track handoff completion
  useEffect(() => {
    if (wasHandingOffRef.current && !isHandingOff) {
      setHandoffCount((c) => c + 1);
      setLastHandoffTime(Date.now());
    }
    wasHandingOffRef.current = isHandingOff;
  }, [isHandingOff]);

  const [shellStats, setShellStats] = useState<ShellStats[]>([]);
  const [tleAge, setTleAge] = useState(() => formatTleAge(tleLastFetched));

  const computeShellStats = useCallback(() => {
    const { count, inclinations, altitudes, launchYears } = getFullCatalog();
    if (!inclinations || !altitudes || !launchYears || count === 0) return;

    const totals = [0, 0, 0, 0, 0];
    const ops = [0, 0, 0, 0, 0];
    // Per-shell, per-year: Map<shellIndex, Map<year, {op, total}>>
    const yearMaps: Map<number, { op: number; total: number }>[] = Array.from({ length: 5 }, () => new Map());

    for (let i = 0; i < count; i++) {
      const inc = inclinations[i];
      const si = shellIndex(inc);
      const yr = launchYears[i];
      const isOp = isOperationalAltitude(inc, altitudes[i]);

      totals[si]++;
      if (isOp) ops[si]++;

      if (yr > 0) {
        const entry = yearMaps[si].get(yr) ?? { op: 0, total: 0 };
        entry.total++;
        if (isOp) entry.op++;
        yearMaps[si].set(yr, entry);
      }
    }

    setShellStats(
      SHELLS.map((s, i) => {
        const years: YearBreakdown[] = Array.from(yearMaps[i].entries())
          .map(([year, { op, total }]) => ({ year, operational: op, total }))
          .sort((a, b) => a.year - b.year);
        return { label: s.label, color: s.color, total: totals[i], operational: ops[i], years };
      })
    );
  }, []);

  // Recompute shell stats every 10s, refresh TLE age every 1s
  useEffect(() => {
    computeShellStats();
    const statsInterval = setInterval(computeShellStats, 10000);
    const ageInterval = setInterval(() => {
      setTleAge(formatTleAge(useAppStore.getState().tleLastFetched));
    }, 1000);
    return () => { clearInterval(statsInterval); clearInterval(ageInterval); };
  }, [computeShellStats]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false });
  };

  const totalSats = shellStats.reduce((sum, s) => sum + s.total, 0);
  const totalOps = shellStats.reduce((sum, s) => sum + s.operational, 0);

  return (
    <div className="hud-panel p-4 w-full md:w-[280px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-2">
        Starlink Network
      </div>

      {/* Connection health indicators */}
      <div className="flex items-center gap-3 text-[10px] text-white/50 mb-2">
        <span className={demoMode ? 'text-yellow-400' : 'text-cyan-400/70'} title={demoMode ? 'Using simulated telemetry' : 'Connected to dish telemetry'}>
          {demoMode ? 'DEMO' : 'LIVE'}
        </span>
        <span className="text-white/20">|</span>
        <span className={tleAge === 'stale' ? 'text-red-400' : ''} title="Age of Two-Line Element orbital data">
          TLE {tleAge}
        </span>
        <span className="text-white/20">|</span>
        <span className="flex items-center gap-1" title={wsConnected ? 'WebSocket connected to server' : 'WebSocket disconnected'}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-500'}`} />
          WS
        </span>
      </div>

      {/* Shell stats */}
      {shellStats.length > 0 && (
        <>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-2 gap-y-0.5 text-[10px] tabular-nums">
            <span className="text-white/30"></span>
            <span className="text-white/30 text-right">Operational</span>
            <span className="text-white/30 text-right">Total</span>
            <span className="text-white/30 text-right">%</span>
            {shellStats.map((s) => {
              const yearTooltip = s.years.length > 0
                ? s.years.map((y) => {
                    const pct = y.total > 0 ? Math.round((y.operational / y.total) * 100) : 0;
                    return `${y.year}: ${y.operational} / ${y.total} operational (${pct}%)`;
                  }).join('\n')
                : 'No satellites launched';
              return (
                <div key={s.label} className="contents cursor-default" title={yearTooltip}>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="text-white/50">{s.label}</span>
                  </span>
                  <span className="text-white/60 text-right">{s.operational.toLocaleString()}</span>
                  <span className="text-white/40 text-right">{s.total.toLocaleString()}</span>
                  <span className="text-white/60 text-right">
                    {s.total > 0 ? `${Math.round((s.operational / s.total) * 100)}%` : '—'}
                  </span>
                </div>
              );
            })}
            {/* Totals row */}
            <div className="contents">
              <span className="text-white/50 font-medium pt-0.5 border-t border-white/10">All</span>
              <span className="text-white/60 text-right font-medium pt-0.5 border-t border-white/10">{totalOps.toLocaleString()}</span>
              <span className="text-white/40 text-right pt-0.5 border-t border-white/10">{totalSats.toLocaleString()}</span>
              <span className="text-white/60 text-right font-medium pt-0.5 border-t border-white/10">
                {totalSats > 0 ? Math.round((totalOps / totalSats) * 100) : 0}%
              </span>
            </div>
          </div>
          <Link
            href="/fleet"
            className="block text-[9px] text-cyan-400/50 hover:text-cyan-400 transition-colors mt-1.5 text-right"
          >
            Fleet Health →
          </Link>
        </>
      )}

      <hr className="hud-divider my-2" />

      {/* Ground stations */}
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] text-white/50">Gateways</span>
        <span className="text-[10px] tabular-nums text-white/60">
          <span style={{ color: '#ff9933' }}>{getGSCounts().operational}</span>
          <span className="text-white/30"> operational</span>
          {getGSCounts().planned > 0 && (
            <>
              <span className="text-white/20"> + </span>
              <span className="text-white/30">{getGSCounts().planned} planned</span>
            </>
          )}
        </span>
      </div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] text-white/50">PoPs</span>
        <span className="text-[10px] tabular-nums text-white/60">
          <span style={{ color: '#66ccff' }}>{getGSCounts().pops}</span>
          <span className="text-white/30"> cities</span>
        </span>
      </div>

      <hr className="hud-divider my-2" />

      {/* Handoff stats */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60">
          Handoff
        </div>
        {isHandingOff && (
          <span className="text-[10px] uppercase tracking-wider text-fuchsia-400 animate-pulse font-semibold">
            Active
          </span>
        )}
      </div>

      {isHandingOff && (
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${handoffProgress * 100}%`,
              backgroundColor: '#e879f9',
              boxShadow: '0 0 8px rgba(232, 121, 249, 0.6)',
            }}
          />
        </div>
      )}

      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] text-white/50">Last handoff</span>
        <span className="text-[11px] tabular-nums text-white/60">
          {lastHandoffTime ? formatTime(lastHandoffTime) : '---'}
        </span>
      </div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] text-white/50">Count</span>
        <span className="text-[11px] tabular-nums text-white/60">{handoffCount}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] text-white/50">Unique satellites</span>
        <span className="text-[11px] tabular-nums text-white/60">{uniqueSatCount}</span>
      </div>
    </div>
  );
}
