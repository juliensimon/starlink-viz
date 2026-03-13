'use client';

import { useState, useEffect } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { formatUptime } from '@/lib/utils/formatting';

const stateColors: Record<string, string> = {
  CONNECTED: 'bg-green-400',
  SEARCHING: 'bg-yellow-400',
  BOOTING: 'bg-yellow-400',
  UNKNOWN: 'bg-gray-400',
};

const stateColorForDot = (state: string): string => {
  if (state.includes('ERROR') || state.includes('FAULT')) return 'bg-red-500';
  return stateColors[state] ?? 'bg-red-500';
};

export default function StatusBar() {
  const status = useTelemetryStore((s) => s.dishStatus);
  const connected = status !== null;
  const [uptimeOffset, setUptimeOffset] = useState(0);

  // Tick uptime locally every second
  useEffect(() => {
    const interval = setInterval(() => {
      setUptimeOffset((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset offset when status updates
  useEffect(() => {
    setUptimeOffset(0);
  }, [status?.uptime]);

  const state = status?.state ?? 'UNKNOWN';
  const uptime = (status?.uptime ?? 0) + uptimeOffset;
  const dropRate = status?.dropRate ?? 0;
  const quality = Math.max(0, Math.round((1 - dropRate) * 100));
  const deviceId = status?.deviceId ?? '---';
  const softwareVersion = status?.softwareVersion ?? '---';

  return (
    <div className="hud-panel p-3 w-[280px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-2">
        System Status
      </div>

      {/* State indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2.5 h-2.5 rounded-full ${stateColorForDot(state)} ${state === 'CONNECTED' ? 'animate-pulse' : ''}`} />
        <span className="text-sm text-white/90">{connected ? state : 'OFFLINE'}</span>
      </div>

      {/* Uptime */}
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[11px] text-white/50">Uptime</span>
        <span className="text-sm tabular-nums hud-glow-text">
          {formatUptime(uptime)}
        </span>
      </div>

      {/* Connection quality */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] text-white/50">Quality</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${quality}%`,
                backgroundColor: quality > 80 ? '#00ffff' : quality > 50 ? '#facc15' : '#ef4444',
              }}
            />
          </div>
          <span className="text-xs tabular-nums hud-glow-text">{quality}%</span>
        </div>
      </div>

      <hr className="hud-divider my-2" />

      {/* Device info */}
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] text-white/40">Device</span>
        <span className="text-[10px] text-white/40 tabular-nums">{deviceId}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] text-white/40">Version</span>
        <span className="text-[10px] text-white/40 tabular-nums">{softwareVersion}</span>
      </div>
    </div>
  );
}
