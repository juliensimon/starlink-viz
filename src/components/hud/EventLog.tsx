'use client';

import { useRef, useEffect } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';

const typeColors: Record<string, string> = {
  info: 'text-cyan-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-fuchsia-400',
  handoff: 'text-fuchsia-400',
};

export default function EventLog() {
  const events = useTelemetryStore((s) => s.events);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events]);

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="hud-panel p-3 w-[400px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-2">
        Event Log
      </div>

      <div
        ref={scrollRef}
        className="h-[120px] overflow-y-auto space-y-0.5 scrollbar-thin"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,255,255,0.2) transparent',
        }}
      >
        {events.length === 0 ? (
          <div className="text-[11px] text-white/30 italic">No events yet...</div>
        ) : (
          events.map((event, i) => (
            <div key={i} className="flex gap-2 text-[11px] leading-relaxed">
              <span className="text-white/30 tabular-nums flex-shrink-0">
                {formatTimestamp(event.timestamp)}
              </span>
              <span className={typeColors[event.type] ?? 'text-white/60'}>
                {event.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
