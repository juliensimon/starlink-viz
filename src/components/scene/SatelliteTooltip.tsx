'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTLEData, getPositionsArray } from '@/lib/satellites/satellite-store';
import { useAppStore } from '@/stores/app-store';

export interface TooltipData {
  name: string;
  noradId: string;
  altitude: string;
  launchYear: number | null;
  launchNum: string | null;
  isConnected: boolean;
  x: number;
  y: number;
}

function parseNoradId(line1: string): string {
  return line1.substring(2, 7).trim();
}

function parseLaunchInfo(line1: string): { year: number; launch: string } | null {
  const intlDesig = line1.substring(9, 17).trim();
  if (!intlDesig) return null;
  const yy = parseInt(intlDesig.substring(0, 2), 10);
  const year = yy >= 57 ? 1900 + yy : 2000 + yy;
  const launch = intlDesig.substring(2, 5).trim();
  return { year, launch };
}

function estimateAltitude(x: number, y: number, z: number): string {
  const dist = Math.sqrt(x * x + y * y + z * z);
  const altKm = Math.round((dist - 1) * 6371);
  return `~${altKm} km`;
}

function dispatchTooltip(data: TooltipData | null) {
  window.dispatchEvent(new CustomEvent('satellite-tooltip', { detail: data }));
}

const MAX_PICK_DISTANCE_PX = 15;
const _projected = new THREE.Vector3();

/**
 * Screen-space nearest-neighbor satellite picking.
 * Projects each satellite position to screen coordinates and finds
 * the closest one to the mouse cursor within MAX_PICK_DISTANCE_PX.
 */
export default function SatelliteTooltip() {
  const { camera, gl } = useThree();
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const needsRaycast = useRef(false);
  const lastTooltipIdx = useRef<number | null>(null);
  const lastMoveTime = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const now = performance.now();
    if (now - lastMoveTime.current < 80) return;
    lastMoveTime.current = now;
    mouseX.current = e.clientX;
    mouseY.current = e.clientY;
    needsRaycast.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    dispatchTooltip(null);
    lastTooltipIdx.current = null;
    needsRaycast.current = false;
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [gl, handleMouseMove, handleMouseLeave]);

  useFrame(() => {
    if (!needsRaycast.current) return;
    needsRaycast.current = false;

    const positions = getPositionsArray();
    const tleData = getTLEData();
    if (!positions || tleData.length === 0) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mx = mouseX.current - rect.left;
    const my = mouseY.current - rect.top;
    const connectedSatelliteIndex = useAppStore.getState().connectedSatelliteIndex;

    let bestIdx = -1;
    let bestDistSq = MAX_PICK_DISTANCE_PX * MAX_PICK_DISTANCE_PX;

    const count = tleData.length;
    // Sample every 1st satellite for performance (10K projections per frame is expensive)
    // But check all within the first pass
    for (let i = 0; i < count; i++) {
      const pi = i * 3;
      const x = positions[pi];
      const y = positions[pi + 1];
      const z = positions[pi + 2];
      if (x === 0 && y === 0 && z === 0) continue;

      _projected.set(x, y, z).project(camera);

      // Skip if behind camera
      if (_projected.z > 1) continue;

      const sx = ((_projected.x + 1) / 2) * rect.width;
      const sy = ((-_projected.y + 1) / 2) * rect.height;

      const dx = sx - mx;
      const dy = sy - my;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      if (bestIdx === lastTooltipIdx.current) return;
      lastTooltipIdx.current = bestIdx;

      const tle = tleData[bestIdx];
      const pi = bestIdx * 3;
      _projected.set(positions[pi], positions[pi + 1], positions[pi + 2]).project(camera);

      const launch = parseLaunchInfo(tle.line1);
      dispatchTooltip({
        name: tle.name,
        noradId: parseNoradId(tle.line1),
        altitude: estimateAltitude(positions[pi], positions[pi + 1], positions[pi + 2]),
        launchYear: launch?.year ?? null,
        launchNum: launch?.launch ?? null,
        isConnected: bestIdx === connectedSatelliteIndex,
        x: ((_projected.x + 1) / 2) * rect.width + rect.left,
        y: ((-_projected.y + 1) / 2) * rect.height + rect.top,
      });
    } else {
      if (lastTooltipIdx.current !== null) {
        dispatchTooltip(null);
        lastTooltipIdx.current = null;
      }
    }
  });

  return null;
}
