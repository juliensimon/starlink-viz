'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { useAppStore } from '@/stores/app-store';

export function useDishStatus() {
  const dishStatus = useTelemetryStore((s) => s.dishStatus);
  const events = useTelemetryStore((s) => s.events);
  const history = useTelemetryStore((s) => s.history);
  const demoMode = useAppStore((s) => s.demoMode);

  return {
    status: dishStatus,
    history,
    connected: dishStatus !== null,
    demoMode,
    events,
  };
}
