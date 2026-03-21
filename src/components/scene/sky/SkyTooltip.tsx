'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getTLEData,
  getPositionsArray,
  getInclinationsArray,
  getSatelliteCount,
} from '@/lib/satellites/satellite-store';
import { useAppStore } from '@/stores/app-store';
import { computeObserverFrame, computeAzElFrom, azElToDirection3D } from '@/lib/utils/observer-frame';
import { isSatelliteSunlit } from '@/lib/utils/sun-shadow';
import { getSunDirection } from '@/lib/utils/astronomy';
import { getDimColor } from '@/lib/utils/shell-colors';
import { raDecToAzEl } from '@/lib/utils/star-coordinates';
import { BRIGHT_STARS } from '@/data/bright-stars';
import { DISH_LAT_DEG, DISH_LON_DEG, EARTH_RADIUS_KM } from '@/lib/config';

export interface SkyTooltipData {
  name: string;
  noradId: string;
  altitude: string;
  shell: string;
  shellColor: string;
  az: number;
  el: number;
  sunlit: boolean;
  isConnected: boolean;
  x: number;
  y: number;
}

function shellName(inc: number): { name: string; color: string } {
  if (inc >= 80) return { name: '97.6° polar', color: '#ff4466' };
  if (inc >= 60) return { name: '70° shell', color: '#22ddbb' };
  if (inc >= 48) return { name: '53° shell', color: '#6699ff' };
  if (inc >= 38) return { name: '43° shell', color: '#ff8844' };
  return { name: '33° shell', color: '#eecc22' };
}

export interface StarTooltipData {
  name: string;
  mag: number;
  x: number;
  y: number;
}

function dispatchSkyTooltip(data: SkyTooltipData | null) {
  window.dispatchEvent(new CustomEvent('sky-tooltip', { detail: data }));
}

function dispatchStarTooltip(data: StarTooltipData | null) {
  window.dispatchEvent(new CustomEvent('star-tooltip', { detail: data }));
}

const DOME_RADIUS = 2.0;
const MAX_PICK_DISTANCE_PX = 20;
const _projected = new THREE.Vector3();

/**
 * Screen-space nearest-neighbor picking for sky view satellites.
 * Projects dome positions to screen coords and finds closest to cursor.
 * Enriches tooltip with az/el, shell, and sunlit status.
 */
export default function SkyTooltip() {
  const { camera, gl } = useThree();
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const needsRaycast = useRef(false);
  const lastTooltipIdx = useRef<number | null>(null);
  const lastMoveTime = useRef(0);

  const demoLocation = useAppStore((s) => s.demoLocation);
  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;
  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const now = performance.now();
    if (now - lastMoveTime.current < 80) return;
    lastMoveTime.current = now;
    mouseX.current = e.clientX;
    mouseY.current = e.clientY;
    needsRaycast.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    dispatchSkyTooltip(null);
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
    const inclinations = getInclinationsArray();
    if (!positions || tleData.length === 0) return;

    const count = getSatelliteCount();
    const rect = gl.domElement.getBoundingClientRect();
    const mx = mouseX.current - rect.left;
    const my = mouseY.current - rect.top;
    const connectedIdx = useAppStore.getState().connectedSatelliteIndex;

    let bestIdx = -1;
    let bestDistSq = MAX_PICK_DISTANCE_PX * MAX_PICK_DISTANCE_PX;

    // We need to project dome positions (not orbital positions) to screen
    // Recompute az/el and dome position for each candidate
    for (let i = 0; i < count; i++) {
      const pi = i * 3;
      const x = positions[pi], y = positions[pi + 1], z = positions[pi + 2];
      if (x === 0 && y === 0 && z === 0) continue;

      const { az, el } = computeAzElFrom(frame, x, y, z);
      if (el < 0) continue;

      const dir = azElToDirection3D(frame, az, el);
      _projected.set(
        frame.pos.x + dir.x * DOME_RADIUS,
        frame.pos.y + dir.y * DOME_RADIUS,
        frame.pos.z + dir.z * DOME_RADIUS
      ).project(camera);

      if (_projected.z > 1) continue;

      const sx = ((_projected.x + 1) / 2) * rect.width;
      const sy = ((-_projected.y + 1) / 2) * rect.height;

      const ddx = sx - mx;
      const ddy = sy - my;
      const distSq = ddx * ddx + ddy * ddy;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIdx = i;
      }
    }

    // Also check bright stars
    let bestStarIdx = -1;
    let bestStarDistSq = MAX_PICK_DISTANCE_PX * MAX_PICK_DISTANCE_PX;
    const now = new Date();
    for (let i = 0; i < BRIGHT_STARS.length; i++) {
      const star = BRIGHT_STARS[i];
      if (!star.name) continue; // only named stars are hoverable

      const { az, el } = raDecToAzEl(star.ra, star.dec, now, lat, lon);
      if (el < 0) continue;

      const dir = azElToDirection3D(frame, az, el);
      _projected.set(
        frame.pos.x + dir.x * DOME_RADIUS,
        frame.pos.y + dir.y * DOME_RADIUS,
        frame.pos.z + dir.z * DOME_RADIUS
      ).project(camera);

      if (_projected.z > 1) continue;

      const sx = ((_projected.x + 1) / 2) * rect.width;
      const sy = ((-_projected.y + 1) / 2) * rect.height;
      const ddx = sx - mx, ddy = sy - my;
      const distSq = ddx * ddx + ddy * ddy;

      if (distSq < bestStarDistSq) {
        bestStarDistSq = distSq;
        bestStarIdx = i;
      }
    }

    // Star wins if it's closer than any satellite
    if (bestStarIdx >= 0 && bestStarDistSq < bestDistSq) {
      const star = BRIGHT_STARS[bestStarIdx];
      const { az, el } = raDecToAzEl(star.ra, star.dec, now, lat, lon);
      const dir = azElToDirection3D(frame, az, el);
      _projected.set(
        frame.pos.x + dir.x * DOME_RADIUS,
        frame.pos.y + dir.y * DOME_RADIUS,
        frame.pos.z + dir.z * DOME_RADIUS
      ).project(camera);

      dispatchSkyTooltip(null);
      window.dispatchEvent(new CustomEvent('sky-trajectory', { detail: null }));
      dispatchStarTooltip({
        name: star.name,
        mag: star.mag,
        x: ((_projected.x + 1) / 2) * rect.width + rect.left,
        y: ((-_projected.y + 1) / 2) * rect.height + rect.top,
      });
      lastTooltipIdx.current = -(bestStarIdx + 1); // negative to distinguish from sat
      return;
    }

    if (bestIdx >= 0) {
      if (bestIdx === lastTooltipIdx.current) return;
      dispatchStarTooltip(null);
      lastTooltipIdx.current = bestIdx;

      const tle = tleData[bestIdx];
      const pi = bestIdx * 3;
      const x = positions[pi], y = positions[pi + 1], z = positions[pi + 2];

      const { az, el } = computeAzElFrom(frame, x, y, z);
      const inc = inclinations ? inclinations[bestIdx] : 53;
      const { name: sName, color: sColor } = shellName(inc);

      // Altitude
      const dist = Math.sqrt(x * x + y * y + z * z);
      const altKm = Math.round((dist - 1) * EARTH_RADIUS_KM);

      // Sunlit?
      const sunDir = getSunDirection(new Date());
      const sunlit = isSatelliteSunlit(x, y, z, sunDir.x, sunDir.y, sunDir.z);

      // Project dome position for tooltip screen coords
      const tooltipDir = azElToDirection3D(frame, az, el);
      _projected.set(
        frame.pos.x + tooltipDir.x * DOME_RADIUS,
        frame.pos.y + tooltipDir.y * DOME_RADIUS,
        frame.pos.z + tooltipDir.z * DOME_RADIUS
      ).project(camera);

      dispatchSkyTooltip({
        name: tle.name,
        noradId: tle.line1.substring(2, 7).trim(),
        altitude: `${altKm} km`,
        shell: sName,
        shellColor: sColor,
        az: Math.round(az * 10) / 10,
        el: Math.round(el * 10) / 10,
        sunlit,
        isConnected: bestIdx === connectedIdx,
        x: ((_projected.x + 1) / 2) * rect.width + rect.left,
        y: ((-_projected.y + 1) / 2) * rect.height + rect.top,
      });
      // Dispatch trajectory event
      window.dispatchEvent(new CustomEvent('sky-trajectory', { detail: { satIdx: bestIdx } }));
    } else {
      if (lastTooltipIdx.current !== null) {
        dispatchSkyTooltip(null);
        dispatchStarTooltip(null);
        window.dispatchEvent(new CustomEvent('sky-trajectory', { detail: null }));
        lastTooltipIdx.current = null;
      }
    }
  });

  return null;
}
