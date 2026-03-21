'use client';

import React from 'react';
import { ChartPanel } from '../ChartPanel';
import { SHELL_COLORS } from '../shell-colors';
import { SHELL_TARGETS } from '@/lib/config';

interface ShellFillRateProps {
  shells: Array<{ shell_id: number; operational_count: number }>;
}

// Display order: 53° first, then 70°, 43°, 97.6°, 33°
const SHELL_ORDER = [2, 3, 1, 4, 0];

export function ShellFillRate({ shells }: ShellFillRateProps) {
  const shellMap = new Map(shells.map((s) => [s.shell_id, s.operational_count]));

  return (
    <ChartPanel
      title="Shell Fill Rate"
      subtitle="Operational satellites vs FCC-authorized targets per shell"
      footnote="Targets from FCC 22-91 (Gen2) and earlier Gen1 filings. Actual shell sizes may change with future amendments."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
        {SHELL_ORDER.map((id) => {
          const target = SHELL_TARGETS[id];
          const count = shellMap.get(id) ?? 0;
          const pct = target.target > 0 ? (count / target.target) * 100 : 0;
          const barPct = Math.min(pct, 100);
          const overTarget = pct > 100;
          const sc = SHELL_COLORS[id];

          return (
            <div key={id}>
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: sc.color,
                    }}
                  />
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#fff', fontWeight: 'bold' }}>
                    {sc.label}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
                    {target.purpose} &middot; {target.altitude} &middot; {target.planes} planes
                  </span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ color: '#fff' }}>{count.toLocaleString()}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}> / {target.target.toLocaleString()}</span>
                  <span style={{ color: overTarget ? '#4ade80' : sc.color, marginLeft: 6 }}>{pct.toFixed(1)}%</span>
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 10,
                  borderRadius: 5,
                  background: 'rgba(255,255,255,0.05)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${barPct}%`,
                    borderRadius: 5,
                    background: `linear-gradient(90deg, ${sc.color}cc, ${sc.color})`,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ChartPanel>
  );
}
