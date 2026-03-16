'use client';

import React from 'react';
import type { TooltipProps } from 'recharts';

export function FleetTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

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
          {entry.name}: {entry.value?.toLocaleString()}
        </div>
      ))}
    </div>
  );
}
