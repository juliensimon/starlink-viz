'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';
import { getPositionsArray, getSatelliteCount } from '@/lib/satellites/satellite-store';
import { computeObserverFrame, computeAzElFrom } from '@/lib/utils/observer-frame';
import { isSunBelowHorizon, isSatelliteSunlit } from '@/lib/utils/sun-shadow';
import { getSunDirection } from '@/lib/utils/astronomy';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

interface SkyStats {
  sunElDeg: number;
  isDark: boolean;
  sunlitAbove: number;
  shadowAbove: number;
  totalAbove: number;
  utcTime: string;
}

function computeStats(): SkyStats {
  const now = new Date();
  const demoLoc = useAppStore.getState().demoLocation;
  const lat = demoLoc?.lat ?? DISH_LAT_DEG;
  const lon = demoLoc?.lon ?? DISH_LON_DEG;

  const frame = computeObserverFrame(lat, lon);
  const sunDir = getSunDirection(now);

  // Sun elevation
  const sunAzEl = computeAzElFrom(frame, sunDir.x * 100, sunDir.y * 100, sunDir.z * 100);
  const isDark = isSunBelowHorizon(
    frame.normal.x, frame.normal.y, frame.normal.z,
    sunDir.x, sunDir.y, sunDir.z
  );

  // Count satellites above horizon
  const positions = getPositionsArray();
  const count = getSatelliteCount();
  let sunlitAbove = 0;
  let shadowAbove = 0;

  if (positions) {
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const x = positions[idx], y = positions[idx + 1], z = positions[idx + 2];
      if (x === 0 && y === 0 && z === 0) continue;

      const { el } = computeAzElFrom(frame, x, y, z);
      if (el < 0) continue;

      if (isSatelliteSunlit(x, y, z, sunDir.x, sunDir.y, sunDir.z)) {
        sunlitAbove++;
      } else {
        shadowAbove++;
      }
    }
  }

  return {
    sunElDeg: sunAzEl.el,
    isDark,
    sunlitAbove,
    shadowAbove,
    totalAbove: sunlitAbove + shadowAbove,
    utcTime: now.toISOString().substring(11, 19) + ' UTC',
  };
}

export default function SkyHud() {
  const cameraMode = useAppStore((s) => s.cameraMode);
  const [stats, setStats] = useState<SkyStats | null>(null);

  useEffect(() => {
    if (cameraMode !== 'sky') return;

    const update = () => setStats(computeStats());
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [cameraMode]);

  if (cameraMode !== 'sky' || !stats) return null;

  return (
    <div className="hud-panel p-3 w-[240px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-2">
        Sky View
      </div>

      {!stats.isDark && (
        <div className="text-[10px] text-yellow-400/80 mb-2 flex items-center gap-1.5">
          <span className="text-sm">&#9788;</span>
          <span>Daytime — satellites not visible to naked eye</span>
        </div>
      )}

      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between text-white/50" title="Angle of the sun above or below the observer's horizon. Negative = nighttime.">
          <span>Sun elevation</span>
          <span className="text-white/70">{stats.sunElDeg.toFixed(1)}&deg;</span>
        </div>
        <div className="flex justify-between text-white/50" title="Total Starlink satellites currently above the observer's horizon">
          <span>Above horizon</span>
          <span className="text-white/70">{stats.totalAbove}</span>
        </div>
        <div className="flex justify-between text-white/50" title="Sunlit satellites are illuminated by the sun and potentially visible to the naked eye at night. Shadow satellites are in Earth's shadow.">
          <span>Sunlit / Shadow</span>
          <span className="text-white/70">{stats.sunlitAbove} / {stats.shadowAbove}</span>
        </div>
        <div className="flex justify-between text-white/50" title="Current UTC time used for sun position and sidereal time calculations">
          <span>UTC</span>
          <span className="text-white/70">{stats.utcTime}</span>
        </div>
      </div>
    </div>
  );
}
