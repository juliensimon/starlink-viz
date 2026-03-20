'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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

interface SearchResult {
  norad_id: number;
  name: string;
  status: string;
  altitude_km: number;
  shell_id: number;
  launch_year: number;
}

interface HistoryRow {
  epoch_utc: string;
  altitude_km: number;
  status: string;
}

interface TrackedSat {
  noradId: number;
  name: string;
  color: string;
}

interface DataPoint {
  day: number;
  [key: string]: number | undefined;
}

const PALETTE = ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#c084fc', '#2dd4bf', '#fb923c', '#e879f9'];

// Interesting default picks: a v0.9 prototype (decayed), an early v1.0, and a recent launch
const DEFAULT_NORAD_IDS = [44257, 44713, 56700];

export function SatelliteLifecycle() {
  const [tracked, setTracked] = useState<TrackedSat[]>([]);
  const [histories, setHistories] = useState<Map<number, HistoryRow[]>>(new Map());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load defaults on mount
  useEffect(() => {
    const defaults: TrackedSat[] = DEFAULT_NORAD_IDS.map((id, i) => ({
      noradId: id,
      name: `NORAD ${id}`,
      color: PALETTE[i % PALETTE.length],
    }));

    // Fetch names for defaults
    Promise.all(
      DEFAULT_NORAD_IDS.map((id) =>
        fetch(`/api/fleet/search?q=${id}`)
          .then((r) => r.json())
          .then((rows: SearchResult[]) => rows[0] || null)
          .catch(() => null)
      )
    ).then((results) => {
      const named = defaults.map((d, i) => ({
        ...d,
        name: results[i]?.name || d.name,
      }));
      setTracked(named);
    });
  }, []);

  // Search
  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/fleet/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: SearchResult[]) => {
          setResults(data);
          setShowDropdown(true);
        })
        .catch(() => {});
    }, 300);
  }, []);

  // Add satellite
  const addSat = useCallback((sat: SearchResult) => {
    if (tracked.some((t) => t.noradId === sat.norad_id)) return;
    setTracked((prev) => [
      ...prev,
      { noradId: sat.norad_id, name: sat.name, color: PALETTE[prev.length % PALETTE.length] },
    ]);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  }, [tracked]);

  // Remove satellite
  const removeSat = useCallback((noradId: number) => {
    setTracked((prev) => prev.filter((t) => t.noradId !== noradId));
    setHistories((prev) => {
      const next = new Map(prev);
      next.delete(noradId);
      return next;
    });
  }, []);

  // Fetch histories for tracked sats
  useEffect(() => {
    if (tracked.length === 0) return;
    setLoading(true);
    const toFetch = tracked.filter((t) => !histories.has(t.noradId));
    if (toFetch.length === 0) { setLoading(false); return; }

    Promise.all(
      toFetch.map((s) =>
        fetch(`/api/fleet/satellite/${s.noradId}`)
          .then((r) => r.json())
          .then((rows: HistoryRow[]) => ({ noradId: s.noradId, rows }))
          .catch(() => ({ noradId: s.noradId, rows: [] as HistoryRow[] }))
      )
    ).then((fetched) => {
      setHistories((prev) => {
        const next = new Map(prev);
        for (const { noradId, rows } of fetched) next.set(noradId, rows);
        return next;
      });
      setLoading(false);
    });
  }, [tracked]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    if (histories.size === 0) return [];

    const allDays = new Set<number>();
    const satDays = new Map<number, Map<number, number>>();

    for (const [noradId, rows] of histories) {
      if (!rows || rows.length === 0 || !tracked.some((t) => t.noradId === noradId)) continue;
      const firstTs = new Date(rows[0].epoch_utc).getTime() / 1000;
      const dayMap = new Map<number, number>();
      for (const row of rows) {
        const ts = new Date(row.epoch_utc).getTime() / 1000;
        const day = Math.round((ts - firstTs) / 86400);
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
  }, [histories, tracked]);

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder="Search STARLINK-1234..."
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          padding: '3px 8px',
          width: 180,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 4,
          color: '#fff',
          outline: 'none',
        }}
      />
      {showDropdown && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'rgba(10,10,15,0.98)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 4,
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 100,
            width: 280,
          }}
        >
          {results.map((r) => (
            <div
              key={r.norad_id}
              onMouseDown={() => addSat(r)}
              style={{
                padding: '6px 10px',
                fontFamily: 'monospace',
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: tracked.some((t) => t.noradId === r.norad_id) ? 'rgba(255,255,255,0.3)' : '#fff',
              }}
            >
              <span>{r.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                {r.status} · {Math.round(r.altitude_km)} km · {r.launch_year}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <ChartPanel
      title="Satellite Lifecycle"
      subtitle="Altitude over time — orbit raising → operational → deorbit"
      footnote="Shaded band: operational altitude range (460–570 km). Click a tag to remove."
      controls={controls}
    >
      {/* Tracked satellite tags */}
      {tracked.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {tracked.map((s) => (
            <span
              key={s.noradId}
              onClick={() => removeSat(s.noradId)}
              style={{
                fontFamily: 'monospace',
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 3,
                background: s.color + '22',
                border: `1px solid ${s.color}55`,
                color: s.color,
                cursor: 'pointer',
              }}
            >
              {s.name} ×
            </span>
          ))}
          {loading && (
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
              Loading...
            </span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={280}>
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
            domain={[0, 'auto']}
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
          {tracked.map((s) => (
            <Line
              key={s.noradId}
              type="monotone"
              dataKey={`sat_${s.noradId}`}
              name={s.name}
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
