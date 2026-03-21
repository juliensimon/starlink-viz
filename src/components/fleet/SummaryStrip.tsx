'use client';

import React from 'react';

interface SummaryData {
  total: number;
  operational: number;
  islCapable: number;
  raising: number;
  deorbiting: number;
}

interface SummaryStripProps {
  data: SummaryData | null;
}

const CARDS: Array<{ key: keyof SummaryData; label: string; color: string; description: string }> = [
  { key: 'total', label: 'TOTAL FLEET', color: '#fff', description: 'All tracked NORAD objects' },
  { key: 'operational', label: 'OPERATIONAL', color: '#4ade80', description: 'At target shell altitude' },
  { key: 'islCapable', label: 'ISL CAPABLE', color: '#60a5fa', description: 'Laser inter-satellite links' },
  { key: 'raising', label: 'ORBIT RAISING', color: '#fbbf24', description: 'Below target, climbing' },
  { key: 'deorbiting', label: 'DEORBITING', color: '#fb923c', description: 'Lowering orbit' },
];

export function SummaryStrip({ data }: SummaryStripProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {CARDS.map(({ key, label, color, description }) => (
        <div
          key={key}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: 12,
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
            {label}
          </div>
          <div style={{ fontSize: 22, color, fontWeight: 'bold', margin: '4px 0' }}>
            {data ? data[key].toLocaleString() : '\u2014'}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{description}</div>
        </div>
      ))}
    </div>
  );
}
