'use client';

import { useState, useEffect } from 'react';
import type { TooltipData } from './scene/SatelliteTooltip';
import type { SkyTooltipData, StarTooltipData } from './scene/sky/SkyTooltip';

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
  const [skyTooltip, setSkyTooltip] = useState<SkyTooltipData | null>(null);
  const [starTooltip, setStarTooltip] = useState<StarTooltipData | null>(null);

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
    const skyHandler = (e: Event) => {
      setSkyTooltip((e as CustomEvent<SkyTooltipData | null>).detail);
    };
    const starHandler = (e: Event) => {
      setStarTooltip((e as CustomEvent<StarTooltipData | null>).detail);
    };
    window.addEventListener('satellite-tooltip', satHandler);
    window.addEventListener('gs-tooltip', gsHandler);
    window.addEventListener('gps-satellite-tooltip', gpsHandler);
    window.addEventListener('sky-tooltip', skyHandler);
    window.addEventListener('star-tooltip', starHandler);
    return () => {
      window.removeEventListener('satellite-tooltip', satHandler);
      window.removeEventListener('gs-tooltip', gsHandler);
      window.removeEventListener('gps-satellite-tooltip', gpsHandler);
      window.removeEventListener('sky-tooltip', skyHandler);
      window.removeEventListener('star-tooltip', starHandler);
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
            {tooltip.launchYear && (
              <div className="text-[var(--color-text-dim)]">Launched: {tooltip.launchYear}</div>
            )}
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

      {starTooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: starTooltip.x + 12,
            top: starTooltip.y - 20,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="hud-panel px-3 py-2 text-[11px] leading-relaxed min-w-[140px]">
            <div className="font-semibold text-xs mb-0.5" style={{ color: '#ffffcc' }}>
              {starTooltip.name}
            </div>
            <div className="text-[var(--color-text-dim)]">
              Magnitude: {starTooltip.mag.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {skyTooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: skyTooltip.x + 12,
            top: skyTooltip.y - 20,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="hud-panel px-3 py-2 text-[11px] leading-relaxed min-w-[200px]">
            <div className="font-semibold text-xs mb-1" style={{ color: skyTooltip.shellColor }}>
              {skyTooltip.name}
            </div>
            <div className="text-[var(--color-text-dim)]">NORAD: {skyTooltip.noradId}</div>
            <div className="text-[var(--color-text-dim)]">Alt: {skyTooltip.altitude}</div>
            <div className="text-[var(--color-text-dim)]">
              Az: {skyTooltip.az.toFixed(1)}° &nbsp; El: {skyTooltip.el.toFixed(1)}°
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[var(--color-text-dim)]" style={{ color: skyTooltip.shellColor }}>
                {skyTooltip.shell}
              </span>
              <span className="text-[9px]">
                {skyTooltip.sunlit
                  ? <span className="text-yellow-300">Sunlit</span>
                  : <span className="text-white/30">Shadow</span>
                }
              </span>
            </div>
            {skyTooltip.isConnected && (
              <div className="mt-1">
                <span className="text-cyan-400 font-semibold">Connected</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
