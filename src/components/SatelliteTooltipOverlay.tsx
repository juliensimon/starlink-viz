'use client';

import { useState, useEffect } from 'react';
import type { TooltipData } from './scene/SatelliteTooltip';

/**
 * HTML overlay for satellite tooltip. Renders outside the Canvas.
 * Listens for 'satellite-tooltip' CustomEvents dispatched by SatelliteTooltip.
 */
export default function SatelliteTooltipOverlay() {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setTooltip((e as CustomEvent<TooltipData | null>).detail);
    };
    window.addEventListener('satellite-tooltip', handler);
    return () => {
      window.removeEventListener('satellite-tooltip', handler);
    };
  }, []);

  if (!tooltip) return null;

  return (
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
  );
}
