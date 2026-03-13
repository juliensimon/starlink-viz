'use client';

import { useAppStore } from '@/stores/app-store';
import StatusBar from './StatusBar';
import SatelliteInfoPanel from './SatelliteInfoPanel';
import TelemetryPanel from './TelemetryPanel';
import HandoffPanel from './HandoffPanel';
import EventLog from './EventLog';

export default function HudContainer() {
  const demoMode = useAppStore((s) => s.demoMode);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-10 p-4 md:p-6"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* Demo badge */}
      {demoMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[10px] uppercase tracking-[0.2em] font-semibold animate-pulse">
            Demo Mode
          </div>
        </div>
      )}

      {/* Top-left: Status */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 pointer-events-auto">
        <StatusBar />
      </div>

      {/* Top-right: Satellite info */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 pointer-events-auto">
        <SatelliteInfoPanel />
      </div>

      {/* Bottom-left: Telemetry */}
      <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 pointer-events-auto">
        <TelemetryPanel />
      </div>

      {/* Bottom-right: Handoff */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 pointer-events-auto">
        <HandoffPanel />
      </div>

      {/* Bottom-center: Event log */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <EventLog />
      </div>
    </div>
  );
}
