'use client';

import { useState, useEffect, useRef } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';

const HANDOFF_THRESHOLD_DEG = 10;
const HANDOFF_DURATION_MS = 2000;

export function useHandoff() {
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [handoffProgress, setHandoffProgress] = useState(0);
  const [timeToNextHandoff, setTimeToNextHandoff] = useState<number | null>(null);

  const dishStatus = useTelemetryStore((s) => s.dishStatus);
  const previousRef = useRef<{ azimuth: number; elevation: number } | null>(null);
  const handoffStartRef = useRef<number>(0);
  const lastHandoffTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!dishStatus) return;

    const current = {
      azimuth: dishStatus.azimuth,
      elevation: dishStatus.elevation,
    };

    if (previousRef.current) {
      const azDelta = Math.abs(current.azimuth - previousRef.current.azimuth);
      const elDelta = Math.abs(current.elevation - previousRef.current.elevation);

      if (
        (azDelta > HANDOFF_THRESHOLD_DEG || elDelta > HANDOFF_THRESHOLD_DEG) &&
        !isHandingOff
      ) {
        setIsHandingOff(true);
        handoffStartRef.current = Date.now();
        lastHandoffTimeRef.current = Date.now();
      }
    }

    previousRef.current = current;
  }, [dishStatus, isHandingOff]);

  // Animate handoff progress and reset
  useEffect(() => {
    if (!isHandingOff) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - handoffStartRef.current;
      const progress = Math.min(elapsed / HANDOFF_DURATION_MS, 1);
      setHandoffProgress(progress);

      if (progress >= 1) {
        setIsHandingOff(false);
        setHandoffProgress(0);
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isHandingOff]);

  // Estimate time to next handoff (rough average of 20s between handoffs)
  useEffect(() => {
    const interval = setInterval(() => {
      const sinceLastHandoff = Date.now() - lastHandoffTimeRef.current;
      const avgInterval = 20000; // 20 seconds average
      const remaining = Math.max(0, avgInterval - sinceLastHandoff);
      setTimeToNextHandoff(Math.round(remaining / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    isHandingOff,
    handoffProgress,
    timeToNextHandoff,
  };
}
