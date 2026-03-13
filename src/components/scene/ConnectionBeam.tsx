'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '@/stores/app-store';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { getPositionsArray, getSatelliteCount } from '@/lib/satellites/satellite-store';
import { geodeticToCartesian } from '@/lib/utils/coordinates';
import { GROUND_STATIONS } from '@/lib/satellites/ground-stations';

// Dish location (Paris default)
const DISH_LAT_DEG = 48.8566;
const DISH_LON_DEG = 2.3522;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const DISH_POS = (() => {
  const { x, y, z } = geodeticToCartesian(
    degToRad(DISH_LAT_DEG),
    degToRad(DISH_LON_DEG),
    0,
    1
  );
  return new THREE.Vector3(x, y, z);
})();

const PARTICLE_COUNT = 60;
const BEAM_CURVE_SEGMENTS = 50;

// Precompute ground station 3D positions
const gsPositions = GROUND_STATIONS.map((gs) => {
  const { x, y, z } = geodeticToCartesian(degToRad(gs.lat), degToRad(gs.lon), 0, 1);
  return new THREE.Vector3(x, y, z);
});

/**
 * Find the nearest ground station to a satellite position (in 3D).
 */
function findNearestGS3D(satPos: THREE.Vector3): THREE.Vector3 {
  let nearest = gsPositions[0];
  let minDist = Infinity;
  for (const gsPos of gsPositions) {
    const d = satPos.distanceToSquared(gsPos);
    if (d < minDist) {
      minDist = d;
      nearest = gsPos;
    }
  }
  return nearest;
}

/**
 * Find connected satellite: the satellite closest to the boresight direction
 * from the dish position using azimuth/elevation.
 */
function findConnectedSatellite(
  azimuthDeg: number,
  elevationDeg: number
): number | null {
  const positions = getPositionsArray();
  const count = getSatelliteCount();
  if (!positions || count === 0) return null;

  // Convert azimuth/elevation to a direction vector from dish position
  const az = degToRad(azimuthDeg);
  const el = degToRad(elevationDeg);

  // Boresight direction in local tangent plane (ENU), then rotate to world
  // We approximate by computing a target point along the boresight ray
  const dishNormal = DISH_POS.clone().normalize();

  // Local east and north vectors at dish location
  const up = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(up, dishNormal).normalize();
  if (east.lengthSq() < 0.001) {
    east.set(1, 0, 0);
  }
  const north = new THREE.Vector3().crossVectors(dishNormal, east).normalize();

  // Direction in world coordinates
  const cosEl = Math.cos(el);
  const dir = new THREE.Vector3()
    .addScaledVector(east, Math.sin(az) * cosEl)
    .addScaledVector(north, Math.cos(az) * cosEl)
    .addScaledVector(dishNormal, Math.sin(el))
    .normalize();

  // Find satellite closest to this direction (from dish position)
  let bestIdx = -1;
  let bestDot = -Infinity;

  const satDir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];

    // Skip invalid satellites at origin
    if (x === 0 && y === 0 && z === 0) continue;

    satDir.set(x - DISH_POS.x, y - DISH_POS.y, z - DISH_POS.z).normalize();
    const dot = satDir.dot(dir);

    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  }

  // Only accept if reasonably close to boresight direction
  if (bestIdx >= 0 && bestDot > 0.9) {
    return bestIdx;
  }

  return null;
}

export default function ConnectionBeam() {
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const setConnectedSatellite = useAppStore((s) => s.setConnectedSatellite);
  const dishStatus = useTelemetryStore((s) => s.dishStatus);

  // Create THREE objects imperatively to avoid JSX <line> vs SVG conflict
  const beamLine = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#00ffff'),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, []);

  const gsBeamLine = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#1a6baa'),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, []);

  const particles = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3)
    );
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color('#00ffff'),
      size: 0.006,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
  }, []);

  const particleTRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT));

  // Handoff animation state
  const opacityRef = useRef(1);
  const prevConnectedRef = useRef<number | null>(null);
  const handoffTimeRef = useRef(0);
  const isHandingOffRef = useRef(false);

  // Initialize particle t values evenly distributed
  useEffect(() => {
    const tValues = particleTRef.current;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      tValues[i] = i / PARTICLE_COUNT;
    }
  }, []);

  // Update connected satellite from telemetry
  const lastUpdateRef = useRef(0);
  useEffect(() => {
    if (!dishStatus) return;
    const now = Date.now();
    // Throttle to every 500ms
    if (now - lastUpdateRef.current < 500) return;
    lastUpdateRef.current = now;

    const idx = findConnectedSatellite(dishStatus.azimuth, dishStatus.elevation);
    if (idx !== null && idx !== connectedSatelliteIndex) {
      setConnectedSatellite(idx);
    }
  }, [dishStatus, connectedSatelliteIndex, setConnectedSatellite]);

  // Detect handoff
  useEffect(() => {
    if (
      prevConnectedRef.current !== null &&
      connectedSatelliteIndex !== null &&
      prevConnectedRef.current !== connectedSatelliteIndex
    ) {
      isHandingOffRef.current = true;
      handoffTimeRef.current = 0;
      opacityRef.current = 0;
    }
    prevConnectedRef.current = connectedSatelliteIndex;
  }, [connectedSatelliteIndex]);

  // Build bezier curve between two points with outward control point
  const buildCurve = useCallback(
    (start: THREE.Vector3, end: THREE.Vector3, lift: number = 1.3) => {
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const midDir = mid.clone().normalize();
      const midDist = mid.length();
      const control = midDir.multiplyScalar(Math.max(midDist * lift, lift));
      return new THREE.QuadraticBezierCurve3(start, control, end);
    },
    []
  );

  useFrame((_, delta) => {
    const positions = getPositionsArray();
    if (connectedSatelliteIndex === null || !positions) return;

    const idx = connectedSatelliteIndex * 3;
    const satX = positions[idx];
    const satY = positions[idx + 1];
    const satZ = positions[idx + 2];

    // Skip if satellite is at origin (invalid)
    if (satX === 0 && satY === 0 && satZ === 0) return;

    const satPos = new THREE.Vector3(satX, satY, satZ);

    // Handoff animation
    if (isHandingOffRef.current) {
      handoffTimeRef.current += delta;
      const t = Math.min(handoffTimeRef.current / 0.5, 1); // 500ms fade-in
      opacityRef.current = t;
      if (t >= 1) {
        isHandingOffRef.current = false;
      }
    } else {
      opacityRef.current = 1;
    }

    const opacity = opacityRef.current;

    // Update dish-to-satellite beam
    const dishCurve = buildCurve(DISH_POS, satPos, 1.3);
    const curvePoints = dishCurve.getPoints(BEAM_CURVE_SEGMENTS);

    beamLine.geometry.setFromPoints(curvePoints);
    (beamLine.material as THREE.LineBasicMaterial).opacity = 0.4 * opacity;

    // Update particles
    const tValues = particleTRef.current;
    const posAttr = particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      tValues[i] = (tValues[i] + delta * 0.5) % 1.0;
      const point = dishCurve.getPoint(tValues[i]);
      posArray[i * 3] = point.x;
      posArray[i * 3 + 1] = point.y;
      posArray[i * 3 + 2] = point.z;
    }
    posAttr.needsUpdate = true;
    (particles.material as THREE.PointsMaterial).opacity = 0.7 * opacity;

    // Update satellite-to-ground-station beam
    const nearestGS = findNearestGS3D(satPos);
    const gsCurve = buildCurve(satPos, nearestGS, 1.2);
    const gsPoints = gsCurve.getPoints(BEAM_CURVE_SEGMENTS);

    gsBeamLine.geometry.setFromPoints(gsPoints);
    (gsBeamLine.material as THREE.LineBasicMaterial).opacity = 0.2 * opacity;
  });

  if (connectedSatelliteIndex === null) return null;

  return (
    <group>
      <primitive object={beamLine} />
      <primitive object={particles} />
      <primitive object={gsBeamLine} />
    </group>
  );
}
