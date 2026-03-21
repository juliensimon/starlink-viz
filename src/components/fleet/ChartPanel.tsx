'use client';

import React, { ReactNode } from 'react';

interface ChartPanelProps {
  title: string;
  subtitle: string;
  footnote?: string;
  controls?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

export function ChartPanel({ title, subtitle, footnote, controls, fullWidth, children }: ChartPanelProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: 14,
        ...(fullWidth ? { gridColumn: '1 / -1' } : {}),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: '#fff',
            }}
          >
            {title}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        {controls && <div>{controls}</div>}
      </div>
      {children}
      {footnote && (
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
          {footnote}
        </div>
      )}
    </div>
  );
}
