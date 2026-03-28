'use client';

import { useAppStore } from '@/stores/app-store';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { getSatelliteName } from '@/lib/satellites/satellite-store';
import { useIsMobile } from '@/hooks/useIsMobile';
import StatusBar from './StatusBar';
import SatelliteInfoPanel from './SatelliteInfoPanel';
import TelemetryPanel from './TelemetryPanel';
import HandoffPanel from './HandoffPanel';
import EventLog from './EventLog';
import ViewControls from './ViewControls';
import ColorLegend from './ColorLegend';
import SkyHud from './SkyHud';

type MobileTab = 'status' | 'controls' | 'network' | 'events';

const TAB_ITEMS: { key: MobileTab; label: string; icon: string }[] = [
  { key: 'status', label: 'Status', icon: '◉' },
  { key: 'controls', label: 'Controls', icon: '⚙' },
  { key: 'network', label: 'Network', icon: '⬡' },
  { key: 'events', label: 'Events', icon: '▤' },
];

function MobileStatusPill() {
  const status = useTelemetryStore((s) => s.dishStatus);
  const connIdx = useAppStore((s) => s.connectedSatelliteIndex);
  const state = status?.state ?? 'UNKNOWN';
  const satName = connIdx !== null ? getSatelliteName(connIdx) : null;
  const connected = state === 'CONNECTED';

  return (
    <div className="hud-panel px-3 py-1.5 flex items-center gap-2 text-[11px]">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
      <span className="text-white/70">{connected ? 'LIVE' : state}</span>
      {satName && (
        <>
          <span className="text-white/20">·</span>
          <span className="text-cyan-400/80 truncate max-w-[140px]">{satName}</span>
        </>
      )}
    </div>
  );
}

export default function HudContainer() {
  const hudVisible = useAppStore((s) => s.hudVisible);
  const setHudVisible = useAppStore((s) => s.setHudVisible);
  const mobileHudTab = useAppStore((s) => s.mobileHudTab);
  const setMobileHudTab = useAppStore((s) => s.setMobileHudTab);
  const isMobile = useIsMobile();

  const drawerOpen = mobileHudTab !== null;

  const toggleHud = () => {
    if (isMobile) {
      // On mobile, toggle the drawer
      setMobileHudTab(drawerOpen ? null : 'status');
    } else {
      setHudVisible(!hudVisible);
    }
  };

  return (
    <div
      className="fixed inset-0 pointer-events-none z-10 p-4 md:p-6"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* HUD toggle — always visible */}
      <button
        onClick={toggleHud}
        className="absolute top-4 right-4 md:top-6 md:right-6 pointer-events-auto z-20 w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded bg-black/40 border border-white/10 hover:border-white/30 transition-colors text-white/50 hover:text-white/80"
        title={hudVisible || drawerOpen ? 'Hide HUD' : 'Show HUD'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {(isMobile ? drawerOpen : hudVisible) ? (
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

      {/* ========== DESKTOP LAYOUT (unchanged) ========== */}
      <div className="hidden md:block">
        <div className={hudVisible ? '' : 'invisible'}>
          {/* Top-left: Status + Telemetry + Satellite Link + Handoff stacked */}
          <div className="absolute top-6 left-6 pointer-events-auto space-y-2">
            <StatusBar />
            <TelemetryPanel />
            <SatelliteInfoPanel />
            <HandoffPanel />
          </div>

          {/* Top-right: View controls */}
          <div className="absolute top-16 right-6 pointer-events-auto">
            <ViewControls />
          </div>

          {/* Bottom-right: Color legend */}
          <div className="absolute bottom-6 right-6 pointer-events-auto">
            <ColorLegend />
          </div>

          {/* Bottom-left: Sky view HUD */}
          <div className="absolute bottom-6 left-6 pointer-events-auto">
            <SkyHud />
          </div>

          {/* Bottom-center: Event log */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
            <EventLog />
          </div>
        </div>
      </div>

      {/* ========== MOBILE LAYOUT ========== */}
      <div className="block md:hidden">
        {/* Top-left: Compact status pill (always visible) */}
        <div className="absolute top-4 left-4 pointer-events-auto">
          <MobileStatusPill />
        </div>

        {/* Bottom-left: Sky HUD (compact, sky-mode only) */}
        {!drawerOpen && (
          <div className="absolute bottom-4 left-4 pointer-events-auto">
            <SkyHud />
          </div>
        )}

        {/* Backdrop — tap globe to close drawer */}
        {drawerOpen && (
          <div
            className="absolute inset-0 pointer-events-auto"
            onClick={() => setMobileHudTab(null)}
          />
        )}

        {/* Bottom drawer */}
        <div
          className={`hud-drawer absolute bottom-0 left-0 right-0 pointer-events-auto ${
            drawerOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ maxHeight: '55vh' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Tab strip */}
          <div className="flex border-b border-white/10 px-2">
            {TAB_ITEMS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setMobileHudTab(key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                  mobileHudTab === key
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-white/40'
                }`}
              >
                <span className="text-sm">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Tab content — all rendered, inactive hidden to preserve state */}
          <div className="overflow-y-auto p-3 space-y-2" style={{ maxHeight: 'calc(55vh - 80px)' }}>
            <div className={mobileHudTab === 'status' ? '' : 'hidden'}>
              <StatusBar />
              <div className="mt-2"><TelemetryPanel /></div>
              <div className="mt-2"><SatelliteInfoPanel /></div>
            </div>
            <div className={mobileHudTab === 'controls' ? '' : 'hidden'}>
              <ViewControls />
            </div>
            <div className={mobileHudTab === 'network' ? '' : 'hidden'}>
              <HandoffPanel />
              <div className="mt-2"><ColorLegend /></div>
            </div>
            <div className={mobileHudTab === 'events' ? '' : 'hidden'}>
              <EventLog />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
