'use client';

import { useDishStatus } from '@/hooks/useDishStatus';
import { useAppStore } from '@/stores/app-store';
import { formatDegrees } from '@/lib/utils/formatting';

function CompassIndicator({ azimuth }: { azimuth: number }) {
  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg viewBox="0 0 40 40" className="w-full h-full">
        {/* Outer ring */}
        <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="1" />
        {/* Cardinal ticks */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg - 90) * (Math.PI / 180);
          const x1 = 20 + Math.cos(rad) * 15;
          const y1 = 20 + Math.sin(rad) * 15;
          const x2 = 20 + Math.cos(rad) * 18;
          const y2 = 20 + Math.sin(rad) * 18;
          return (
            <line
              key={deg}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(0,255,255,0.4)"
              strokeWidth="1"
            />
          );
        })}
        {/* Direction pointer */}
        <line
          x1={20}
          y1={20}
          x2={20 + Math.cos((azimuth - 90) * (Math.PI / 180)) * 14}
          y2={20 + Math.sin((azimuth - 90) * (Math.PI / 180)) * 14}
          stroke="#00ffff"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="20" cy="20" r="2" fill="#00ffff" />
      </svg>
    </div>
  );
}

export default function SatelliteInfoPanel() {
  const { status } = useDishStatus();
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);

  const azimuth = status?.boresightAzimuth ?? 0;
  const elevation = status?.boresightElevation ?? 0;
  const hasConnection = connectedSatelliteIndex !== null;

  return (
    <div className="hud-panel p-3 w-[260px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-2">
        Satellite Link
      </div>

      {/* Satellite identity */}
      <div className="flex items-center gap-2 mb-2">
        {hasConnection ? (
          <span className="text-sm hud-glow-text tabular-nums">
            SAT-{String(connectedSatelliteIndex).padStart(4, '0')}
          </span>
        ) : (
          <span className="text-sm text-yellow-400 animate-pulse">Scanning...</span>
        )}
      </div>

      {/* Boresight readings + compass */}
      <div className="flex items-center gap-3 mb-2">
        <CompassIndicator azimuth={azimuth} />
        <div className="flex-1 space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-white/50">Azimuth</span>
            <span className="text-sm tabular-nums hud-glow-text">{formatDegrees(azimuth)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-white/50">Elevation</span>
            <span className="text-sm tabular-nums hud-glow-text">{formatDegrees(elevation)}</span>
          </div>
        </div>
      </div>

      <hr className="hud-divider my-2" />

      {/* Orbital info */}
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] text-white/50">Altitude</span>
        <span className="text-xs tabular-nums text-white/70">~550 km</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] text-white/50">Velocity</span>
        <span className="text-xs tabular-nums text-white/70">~7.5 km/s</span>
      </div>
    </div>
  );
}
