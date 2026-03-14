'use client';

import { useAppStore } from '@/stores/app-store';
import StatusBar from './StatusBar';
import SatelliteInfoPanel from './SatelliteInfoPanel';
import TelemetryPanel from './TelemetryPanel';
import HandoffPanel from './HandoffPanel';
import EventLog from './EventLog';
import ViewControls from './ViewControls';
import ColorLegend from './ColorLegend';

export default function HudContainer() {
  const demoMode = useAppStore((s) => s.demoMode);
  const hudVisible = useAppStore((s) => s.hudVisible);
  const setHudVisible = useAppStore((s) => s.setHudVisible);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-10 p-4 md:p-6"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* HUD toggle — always visible */}
      <button
        onClick={() => setHudVisible(!hudVisible)}
        className="absolute top-4 right-4 md:top-6 md:right-6 pointer-events-auto z-20 w-8 h-8 flex items-center justify-center rounded bg-black/40 border border-white/10 hover:border-white/30 transition-colors text-white/50 hover:text-white/80"
        title={hudVisible ? 'Hide HUD' : 'Show HUD'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {hudVisible ? (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          ) : (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </>
          )}
        </svg>
      </button>

      {/* Use CSS visibility to hide HUD without unmounting, preserving component state */}
      <div className={hudVisible ? '' : 'invisible'}>
        {/* Demo badge */}
        {demoMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
            <div className="px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[10px] uppercase tracking-[0.2em] font-semibold animate-pulse">
              Demo Mode
            </div>
          </div>
        )}

        {/* Top-left: Status + Telemetry + Satellite Link + Handoff stacked */}
        <div className="absolute top-4 left-4 md:top-6 md:left-6 pointer-events-auto space-y-2">
          <StatusBar />
          <div className="hidden md:block">
            <TelemetryPanel />
          </div>
          <SatelliteInfoPanel />
          <HandoffPanel />
        </div>

        {/* Top-right: View controls (offset below toggle button) */}
        <div className="absolute top-14 right-4 md:top-16 md:right-6 pointer-events-auto">
          <ViewControls />
        </div>

        {/* Bottom-right: Color legend (hidden on small screens) */}
        <div className="hidden md:block absolute bottom-4 right-4 md:bottom-6 md:right-6 pointer-events-auto">
          <ColorLegend />
        </div>

        {/* Bottom-center: Event log (hidden on small screens) */}
        <div className="hidden sm:block absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <EventLog />
        </div>
      </div>
    </div>
  );
}
