'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSatellites } from '@/hooks/useSatellites';
import { initSatelliteRecords, propagateBatch, propagateSingle } from '@/lib/satellites/propagator';
import {
  setTLEData,
  setSatrecObjects,
  setPositionsArray,
  setConnectedOrbitalData,
  setInclinationsArray,
  setFullCatalog,
  setRAANArray,
  setISLCapableArray,
} from '@/lib/satellites/satellite-store';
import { computeISLArrays } from '@/lib/satellites/isl-capability';
import { useAppStore } from '@/stores/app-store';
import { isOperationalAltitude } from '@/lib/config';
import type { SatRec } from '@/lib/satellites/propagator';

const NUM_BATCHES = 6;

/**
 * Headless component that owns satellite propagation.
 * Always mounted regardless of camera mode — writes positions
 * into the shared positionsArray in satellite-store.
 */
export default function SatellitePropagator() {
  const { tleData, loading } = useSatellites();
  const satrecsRef = useRef<SatRec[]>([]);
  const positionsRef = useRef<Float32Array | null>(null);
  const batchIndexRef = useRef(0);
  const countRef = useRef(0);
  const altitudeFilter = useAppStore((s) => s.altitudeFilter);

  // Initialize satrecs when TLE data arrives or filter changes
  useEffect(() => {
    if (!tleData || tleData.length === 0) return;

    const totalCount = tleData.length;
    const allSatrecs = initSatelliteRecords(tleData);
    const now = new Date();

    // Propagate all satellites once to get altitudes
    const allInclinations = new Float32Array(totalCount);
    const allAltitudes = new Float32Array(totalCount);
    const allLaunchYears = new Uint16Array(totalCount);
    for (let i = 0; i < totalCount; i++) {
      const inc = parseFloat(tleData[i].line2.substring(8, 16));
      allInclinations[i] = isNaN(inc) ? 53 : inc;
      const data = propagateSingle(allSatrecs[i], now);
      allAltitudes[i] = data ? data.altitudeKm : 0;
      const yy = parseInt(tleData[i].line1.substring(9, 11), 10);
      allLaunchYears[i] = isNaN(yy) ? 0 : (yy >= 57 ? 1900 + yy : 2000 + yy);
    }
    setFullCatalog(totalCount, allInclinations, allAltitudes, allLaunchYears);

    // Compute ISL capability and RAAN for the full catalog
    const tleLines2 = tleData.map((t) => t.line2);
    computeISLArrays(tleLines2, allInclinations, allLaunchYears, totalCount);

    let filteredTle = tleData;
    let filteredSatrecs = allSatrecs;

    if (altitudeFilter) {
      const filteredIndices: number[] = [];
      for (let i = 0; i < totalCount; i++) {
        if (isOperationalAltitude(allInclinations[i], allAltitudes[i])) {
          filteredIndices.push(i);
        }
      }
      filteredTle = filteredIndices.map((i) => tleData[i]);
      filteredSatrecs = filteredIndices.map((i) => allSatrecs[i]);
    }

    console.log(`Showing ${filteredSatrecs.length} satellites${altitudeFilter ? ` (filtered from ${totalCount})` : ''}`);

    setTLEData(filteredTle);
    setSatrecObjects(filteredSatrecs);
    satrecsRef.current = filteredSatrecs;

    const count = filteredSatrecs.length;
    countRef.current = count;
    const posArr = new Float32Array(count * 3);
    positionsRef.current = posArr;
    setPositionsArray(posArr);

    // Parse inclinations from TLE line2
    const inclinations = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const inc = parseFloat(filteredTle[i].line2.substring(8, 16));
      inclinations[i] = isNaN(inc) ? 53 : inc;
    }
    setInclinationsArray(inclinations);

    // Build RAAN + ISL arrays for the filtered set
    const filteredLines2 = filteredTle.map((t) => t.line2);
    const filteredLaunchYears = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      const yy = parseInt(filteredTle[i].line1.substring(9, 11), 10);
      filteredLaunchYears[i] = isNaN(yy) ? 0 : (yy >= 57 ? 1900 + yy : 2000 + yy);
    }
    const { raanArray: filteredRaans, islCapableArray: filteredIsl } = computeISLArrays(
      filteredLines2, inclinations, filteredLaunchYears, count,
    );
    setRAANArray(filteredRaans);
    setISLCapableArray(filteredIsl);

    // Initial propagation
    propagateBatch(filteredSatrecs, now, 0, count, posArr);

    console.log(`Loaded ${count} satellites`);
    useAppStore.getState().setSatellitesLoaded(true);
    useAppStore.getState().bumpSatellitesVersion();
  }, [tleData, altitudeFilter]);

  // Update connected satellite orbital data (every 500ms)
  const orbitalUpdateRef = useRef(0);
  useFrame(() => {
    const now = performance.now();
    if (now - orbitalUpdateRef.current < 500) return;
    orbitalUpdateRef.current = now;

    const idx = useAppStore.getState().connectedSatelliteIndex;
    const satrecs = satrecsRef.current;
    if (idx !== null && satrecs[idx]) {
      const data = propagateSingle(satrecs[idx], new Date());
      setConnectedOrbitalData(data);
    } else {
      setConnectedOrbitalData(null);
    }
  });

  // Per-frame batched propagation
  const propagateFrame = useCallback(() => {
    const satrecs = satrecsRef.current;
    const positions = positionsRef.current;
    const count = countRef.current;

    if (!satrecs.length || !positions || count === 0) return;

    const now = new Date();
    const batchSize = Math.ceil(count / NUM_BATCHES);
    const batchIdx = batchIndexRef.current;
    const startIdx = batchIdx * batchSize;
    const batchCount = Math.min(batchSize, count - startIdx);

    if (batchCount > 0) {
      propagateBatch(satrecs, now, startIdx, batchCount, positions);
    }

    batchIndexRef.current = (batchIdx + 1) % NUM_BATCHES;
  }, []);

  useFrame(propagateFrame);

  if (loading || !tleData) return null;
  return null;
}
