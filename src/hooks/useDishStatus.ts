'use client';

import { useWebSocket } from '@/lib/websocket/client';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { useAppStore } from '@/stores/app-store';

export function useDishStatus() {
  const { connected, dishStatus, dishHistory } = useWebSocket();
  const events = useTelemetryStore((s) => s.events);
  const demoMode = useAppStore((s) => s.demoMode);
  const history = useTelemetryStore((s) => s.history);

  return {
    status: dishStatus,
    history: dishHistory ?? {
      pingLatency: history.ping,
      downlinkThroughput: history.downlink,
      uplinkThroughput: history.uplink,
      snr: history.snr,
    },
    connected,
    demoMode,
    events,
  };
}
