'use client';

import { useState, useEffect, useRef } from 'react';
import { useHandoff } from '@/hooks/useHandoff';

export default function HandoffPanel() {
  const { isHandingOff, handoffProgress, timeToNextHandoff } = useHandoff();
  const [handoffCount, setHandoffCount] = useState(0);
  const [lastHandoffTime, setLastHandoffTime] = useState<number | null>(null);
  const wasHandingOffRef = useRef(false);

  // Track handoff completion
  useEffect(() => {
    if (wasHandingOffRef.current && !isHandingOff) {
      setHandoffCount((c) => c + 1);
      setLastHandoffTime(Date.now());
    }
    wasHandingOffRef.current = isHandingOff;
  }, [isHandingOff]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="hud-panel p-3 w-[240px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60">
          Handoff
        </div>
        {isHandingOff && (
          <span className="text-[10px] uppercase tracking-wider text-magenta-400 text-fuchsia-400 animate-pulse font-semibold">
            Active
          </span>
        )}
      </div>

      {/* Countdown */}
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[11px] text-white/50">Next handoff</span>
        <span className="text-sm tabular-nums hud-glow-text">
          {isHandingOff ? 'NOW' : timeToNextHandoff !== null ? `${timeToNextHandoff}s` : '---'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${isHandingOff ? handoffProgress * 100 : 0}%`,
            backgroundColor: isHandingOff ? '#e879f9' : '#00ffff',
            boxShadow: isHandingOff ? '0 0 8px rgba(232, 121, 249, 0.6)' : 'none',
          }}
        />
      </div>

      <hr className="hud-divider my-2" />

      {/* Stats */}
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] text-white/50">Last handoff</span>
        <span className="text-[11px] tabular-nums text-white/60">
          {lastHandoffTime ? formatTime(lastHandoffTime) : '---'}
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] text-white/50">Count</span>
        <span className="text-[11px] tabular-nums text-white/60">{handoffCount}</span>
      </div>
    </div>
  );
}
