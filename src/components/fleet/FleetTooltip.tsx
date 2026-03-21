'use client';

import React from 'react';

export interface FleetTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  formatter?: (v: number) => string;
}

export function FleetTooltip({ active, payload, label, formatter }: FleetTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const fmt = formatter || ((v: number) => v.toLocaleString());

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.9)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 4,
        padding: '8px 10px',
        fontFamily: 'monospace',
        fontSize: 10,
      }}
    >
      <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: 4 }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ color: entry.color || '#fff', marginTop: 2 }}>
          {entry.name}: {entry.value != null ? fmt(entry.value) : '\u2014'}
        </div>
      ))}
    </div>
  );
}
