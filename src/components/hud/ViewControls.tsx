'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';

export default function ViewControls() {
  const autoRotate = useAppStore((s) => s.autoRotate);
  const setAutoRotate = useAppStore((s) => s.setAutoRotate);
  const altitudeFilter = useAppStore((s) => s.altitudeFilter);
  const setAltitudeFilter = useAppStore((s) => s.setAltitudeFilter);
  const focusDish = useAppStore((s) => s.focusDish);
  const demoMode = useAppStore((s) => s.demoMode);
  const [switching, setSwitching] = useState(false);

  const toggleMode = async () => {
    setSwitching(true);
    try {
      const res = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: demoMode ? 'live' : 'demo' }),
      });
      const data = await res.json();
      useAppStore.getState().setDemoMode(data.mode === 'demo');
    } catch {
      // Will be reported via event log
    }
    setSwitching(false);
  };

  return (
    <div className="hud-panel p-3 w-[280px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-2">
        Controls
      </div>

      {/* Demo/Live toggle */}
      <button
        onClick={toggleMode}
        disabled={switching}
        className="flex items-center gap-2 w-full text-left mb-2 group"
      >
        <div
          className={`w-7 h-3.5 rounded-full transition-colors duration-200 flex items-center ${
            !demoMode ? 'bg-green-500/40 justify-end' : 'bg-yellow-500/40 justify-start'
          }`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full mx-0.5 transition-colors duration-200 ${
              !demoMode ? 'bg-green-400' : 'bg-yellow-400'
            }`}
          />
        </div>
        <div>
          <span className="text-[11px] text-white/70 group-hover:text-white/90 transition-colors">
            {switching ? 'Switching...' : demoMode ? 'Demo' : 'Live'}
          </span>
          <div className="text-[9px] text-white/45 leading-tight">
            {demoMode ? 'Simulated telemetry' : 'Real dish telemetry'}
          </div>
        </div>
      </button>

      {/* Auto-rotate toggle */}
      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className="flex items-center gap-2 w-full text-left mb-2 group"
      >
        <div
          className={`w-7 h-3.5 rounded-full transition-colors duration-200 flex items-center ${
            autoRotate ? 'bg-cyan-500/40 justify-end' : 'bg-white/10 justify-start'
          }`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full mx-0.5 transition-colors duration-200 ${
              autoRotate ? 'bg-cyan-400' : 'bg-white/40'
            }`}
          />
        </div>
        <div>
          <span className="text-[11px] text-white/70 group-hover:text-white/90 transition-colors">
            Rotate
          </span>
          <div className="text-[9px] text-white/45 leading-tight">Auto-rotate the globe</div>
        </div>
      </button>

      {/* Altitude filter toggle */}
      <button
        onClick={() => setAltitudeFilter(!altitudeFilter)}
        className="flex items-center gap-2 w-full text-left mb-2 group"
      >
        <div
          className={`w-7 h-3.5 rounded-full transition-colors duration-200 flex items-center ${
            altitudeFilter ? 'bg-cyan-500/40 justify-end' : 'bg-white/10 justify-start'
          }`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full mx-0.5 transition-colors duration-200 ${
              altitudeFilter ? 'bg-cyan-400' : 'bg-white/40'
            }`}
          />
        </div>
        <div>
          <span className="text-[11px] text-white/70 group-hover:text-white/90 transition-colors">
            Operational only
          </span>
          <div className="text-[9px] text-white/45 leading-tight">Per-shell altitude filtering</div>
        </div>
      </button>

      <hr className="hud-divider my-2" />

      {/* Focus dish button */}
      <button
        onClick={focusDish}
        className="flex items-center gap-2 w-full text-left group"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-cyan-400/60 group-hover:text-cyan-400 transition-colors"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
        <div>
          <span className="text-[11px] text-white/70 group-hover:text-white/90 transition-colors">
            Center on dish
          </span>
          <div className="text-[9px] text-white/45 leading-tight">Pan camera to dish location</div>
        </div>
      </button>
      <hr className="hud-divider my-2" />

      {/* Interaction legend */}
      <div className="space-y-1 text-[10px] text-white/40">
        <div className="flex justify-between">
          <span>Drag</span><span>Rotate</span>
        </div>
        <div className="flex justify-between">
          <span>Scroll</span><span>Zoom</span>
        </div>
        <div className="flex justify-between">
          <span>Double-click</span><span>Focus</span>
        </div>
      </div>
    </div>
  );
}
