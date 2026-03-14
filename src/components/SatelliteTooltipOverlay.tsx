'use client';

import { useState, useEffect } from 'react';
import type { TooltipData } from './scene/SatelliteTooltip';

interface GSTooltipData {
  name: string;
  lat: number;
  lon: number;
  status?: string;
  x: number;
  y: number;
}

interface GpsTooltipData {
  name: string;
  noradId: string;
  altitude: string;
  x: number;
  y: number;
}

export default function SatelliteTooltipOverlay() {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [gsTooltip, setGsTooltip] = useState<GSTooltipData | null>(null);
  const [gpsTooltip, setGpsTooltip] = useState<GpsTooltipData | null>(null);

  useEffect(() => {
    const satHandler = (e: Event) => {
      setTooltip((e as CustomEvent<TooltipData | null>).detail);
    };
    const gsHandler = (e: Event) => {
      setGsTooltip((e as CustomEvent<GSTooltipData | null>).detail);
    };
    const gpsHandler = (e: Event) => {
      setGpsTooltip((e as CustomEvent<GpsTooltipData | null>).detail);
    };
    window.addEventListener('satellite-tooltip', satHandler);
    window.addEventListener('gs-tooltip', gsHandler);
    window.addEventListener('gps-satellite-tooltip', gpsHandler);
    return () => {
      window.removeEventListener('satellite-tooltip', satHandler);
      window.removeEventListener('gs-tooltip', gsHandler);
      window.removeEventListener('gps-satellite-tooltip', gpsHandler);
    };
  }, []);

  return (
    <>
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 20,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="hud-panel px-3 py-2 text-[11px] leading-relaxed min-w-[180px]">
            <div className="text-[var(--color-accent)] font-semibold text-xs mb-1">{tooltip.name}</div>
            <div className="text-[var(--color-text-dim)]">NORAD: {tooltip.noradId}</div>
            <div className="text-[var(--color-text-dim)]">ALT: {tooltip.altitude}</div>
            <div className="mt-1">
              {tooltip.isConnected ? (
                <span className="text-cyan-400 font-semibold">Connected</span>
              ) : (
                <span className="text-[var(--color-text-dim)]">Tracking</span>
              )}
            </div>
          </div>
        </div>
      )}

      {gpsTooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: gpsTooltip.x + 12,
            top: gpsTooltip.y - 20,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="hud-panel px-3 py-2 text-[11px] leading-relaxed min-w-[180px]">
            <div className="font-semibold text-xs mb-1" style={{ color: '#44ff44' }}>
              {gpsTooltip.name}
            </div>
            <div className="text-[var(--color-text-dim)]">NORAD: {gpsTooltip.noradId}</div>
            <div className="text-[var(--color-text-dim)]">ALT: {gpsTooltip.altitude}</div>
            <div className="mt-1">
              <span className="text-[var(--color-text-dim)]">GPS Constellation</span>
            </div>
          </div>
        </div>
      )}

      {gsTooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: gsTooltip.x + 12,
            top: gsTooltip.y - 20,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="hud-panel px-3 py-2 text-[11px] leading-relaxed min-w-[160px]">
            <div className="font-semibold text-xs mb-1" style={{ color: '#ff9933' }}>
              {gsTooltip.name}
            </div>
            <div className="text-[var(--color-text-dim)]">
              {gsTooltip.lat.toFixed(4)}°{gsTooltip.lat >= 0 ? 'N' : 'S'}, {gsTooltip.lon.toFixed(4)}°{gsTooltip.lon >= 0 ? 'E' : 'W'}
            </div>
            <div className="text-[var(--color-text-dim)]">
              Gateway{gsTooltip.status === 'planned' ? ' — Planned' : ' — Operational'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
