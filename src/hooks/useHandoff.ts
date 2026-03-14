'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useTelemetryStore } from '@/stores/telemetry-store';

const HANDOFF_DURATION_MS = 2000;
const MIN_ELEVATION_DEG = 25;

export function useHandoff() {
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [handoffProgress, setHandoffProgress] = useState(0);
  const [timeToNextHandoff, setTimeToNextHandoff] = useState<number | null>(null);

  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const elevation = useTelemetryStore((s) => s.dishStatus?.elevation ?? 0);

  const previousIdxRef = useRef<number | null>(null);
  const handoffStartRef = useRef<number>(0);

  // Track elevation rate of change
  const prevElevationRef = useRef<number>(0);
  const prevElevationTimeRef = useRef<number>(Date.now());

  // Rolling average of elevation rate (5 samples)
  const rateSamplesRef = useRef<number[]>([]);
  const [descentRate, setDescentRate] = useState<number | null>(null);

  // Detect handoff from actual satellite index change
  useEffect(() => {
    if (connectedSatelliteIndex === null) return;

    if (
      previousIdxRef.current !== null &&
      previousIdxRef.current !== connectedSatelliteIndex
    ) {
      setIsHandingOff(true);
      handoffStartRef.current = Date.now();
    }

    previousIdxRef.current = connectedSatelliteIndex;
  }, [connectedSatelliteIndex]);

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

  // Estimate time to next handoff from measured elevation descent rate
  useEffect(() => {
    if (elevation <= MIN_ELEVATION_DEG) {
      setTimeToNextHandoff(0);
      return;
    }

    const now = Date.now();
    const dt = (now - prevElevationTimeRef.current) / 1000; // seconds
    const dEl = elevation - prevElevationRef.current; // degrees

    prevElevationRef.current = elevation;
    prevElevationTimeRef.current = now;

    // Need at least 1s of data, discard stale gaps
    if (dt < 1 || dt > 30) return;

    const instantRate = dEl / dt; // deg/s, negative = descending

    // Push into rolling window and keep last 5
    const samples = rateSamplesRef.current;
    samples.push(instantRate);
    if (samples.length > 5) samples.shift();

    const avgRate = samples.reduce((a, b) => a + b, 0) / samples.length;
    const degreesAboveMin = elevation - MIN_ELEVATION_DEG;

    if (avgRate < -0.001) {
      // Satellite is descending — use smoothed rate
      const absRate = Math.abs(avgRate);
      const estimated = Math.round(degreesAboveMin / absRate);
      setTimeToNextHandoff(Math.min(estimated, 600)); // cap at 10 min
      setDescentRate(absRate);
    } else if (avgRate > 0.001) {
      // Satellite is ascending — no handoff imminent
      setTimeToNextHandoff(null);
      setDescentRate(null);
    } else {
      // Near peak — satellite barely moving in elevation
      setTimeToNextHandoff(null);
      setDescentRate(null);
    }
  }, [elevation]);

  return {
    isHandingOff,
    handoffProgress,
    timeToNextHandoff,
    descentRate,
  };
}
