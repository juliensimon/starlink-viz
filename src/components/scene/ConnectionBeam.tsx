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
const BEAM_SEGMENTS = 50;
const BEAM_VERTS = BEAM_SEGMENTS + 1;

// Precompute ground station 3D positions
const gsPositions = GROUND_STATIONS.map((gs) => {
  const { x, y, z } = geodeticToCartesian(degToRad(gs.lat), degToRad(gs.lon), 0, 1);
  return new THREE.Vector3(x, y, z);
});

// Reusable temp vectors (avoid per-frame allocations)
const _satPos = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _control = new THREE.Vector3();
const _point = new THREE.Vector3();
const _dishNormal = DISH_POS.clone().normalize();
const _east = new THREE.Vector3();
const _north = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _satDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

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

function findConnectedSatellite(
  azimuthDeg: number,
  elevationDeg: number
): number | null {
  const positions = getPositionsArray();
  const count = getSatelliteCount();
  if (!positions || count === 0) return null;

  const az = degToRad(azimuthDeg);
  const el = degToRad(elevationDeg);

  _east.crossVectors(_up, _dishNormal).normalize();
  if (_east.lengthSq() < 0.001) _east.set(1, 0, 0);
  _north.crossVectors(_dishNormal, _east).normalize();

  const cosEl = Math.cos(el);
  _dir.set(0, 0, 0)
    .addScaledVector(_east, Math.sin(az) * cosEl)
    .addScaledVector(_north, Math.cos(az) * cosEl)
    .addScaledVector(_dishNormal, Math.sin(el))
    .normalize();

  let bestIdx = -1;
  let bestDot = -Infinity;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];
    if (x === 0 && y === 0 && z === 0) continue;

    _satDir.set(x - DISH_POS.x, y - DISH_POS.y, z - DISH_POS.z).normalize();
    const dot = _satDir.dot(_dir);
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  }

  return bestIdx >= 0 && bestDot > 0.9 ? bestIdx : null;
}

/**
 * Write bezier curve points into a pre-allocated Float32Array.
 * No allocations per call.
 */
function writeCurvePoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  lift: number,
  outArray: Float32Array,
  segments: number
) {
  _mid.addVectors(start, end).multiplyScalar(0.5);
  const midDist = _mid.length();
  _control.copy(_mid).normalize().multiplyScalar(Math.max(midDist * lift, lift));

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Quadratic bezier: (1-t)²·start + 2(1-t)t·control + t²·end
    const omt = 1 - t;
    const omt2 = omt * omt;
    const t2 = t * t;
    const twoOmtT = 2 * omt * t;
    const idx = i * 3;
    outArray[idx] = omt2 * start.x + twoOmtT * _control.x + t2 * end.x;
    outArray[idx + 1] = omt2 * start.y + twoOmtT * _control.y + t2 * end.y;
    outArray[idx + 2] = omt2 * start.z + twoOmtT * _control.z + t2 * end.z;
  }
}

/**
 * Get a point on the bezier for particle positioning.
 */
function bezierPoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
  t: number,
  out: THREE.Vector3
) {
  // Reuse the _control that was last set by writeCurvePoints for the dish beam
  const omt = 1 - t;
  out.set(
    omt * omt * start.x + 2 * omt * t * _control.x + t * t * end.x,
    omt * omt * start.y + 2 * omt * t * _control.y + t * t * end.y,
    omt * omt * start.z + 2 * omt * t * _control.z + t * t * end.z
  );
}

export default function ConnectionBeam() {
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const setConnectedSatellite = useAppStore((s) => s.setConnectedSatellite);
  const dishStatus = useTelemetryStore((s) => s.dishStatus);

  // Pre-allocate beam geometry buffers (dish beam)
  const beamLine = useMemo(() => {
    const posArray = new Float32Array(BEAM_VERTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#00ffff'),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, []);

  // Pre-allocate ground station beam geometry
  const gsBeamLine = useMemo(() => {
    const posArray = new Float32Array(BEAM_VERTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#1a6baa'),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, []);

  // Pre-allocate particle geometry
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

  const particleTRef = useRef(new Float32Array(PARTICLE_COUNT));

  // Handoff animation state
  const opacityRef = useRef(1);
  const prevConnectedRef = useRef<number | null>(null);
  const handoffTimeRef = useRef(0);
  const isHandingOffRef = useRef(false);

  // Store last dish-to-sat curve control point for particle bezier
  const lastDishCurveStartRef = useRef(DISH_POS);
  const lastDishCurveEndRef = useRef(new THREE.Vector3());
  const lastControlRef = useRef(new THREE.Vector3());

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

  useFrame((_, delta) => {
    const positions = getPositionsArray();
    if (connectedSatelliteIndex === null || !positions) return;

    const idx = connectedSatelliteIndex * 3;
    _satPos.set(positions[idx], positions[idx + 1], positions[idx + 2]);

    // Skip if satellite is at origin (invalid)
    if (_satPos.x === 0 && _satPos.y === 0 && _satPos.z === 0) return;

    // Handoff animation
    if (isHandingOffRef.current) {
      handoffTimeRef.current += delta;
      const t = Math.min(handoffTimeRef.current / 0.5, 1);
      opacityRef.current = t;
      if (t >= 1) isHandingOffRef.current = false;
    } else {
      opacityRef.current = 1;
    }

    const opacity = opacityRef.current;

    // Update dish-to-satellite beam (writes into pre-allocated buffer)
    const beamPosAttr = beamLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    writeCurvePoints(DISH_POS, _satPos, 1.3, beamPosAttr.array as Float32Array, BEAM_SEGMENTS);
    beamPosAttr.needsUpdate = true;
    (beamLine.material as THREE.LineBasicMaterial).opacity = 0.4 * opacity;

    // Save control point for particle bezier
    lastDishCurveEndRef.current.copy(_satPos);
    lastControlRef.current.copy(_control);

    // Update particles along dish beam
    const tValues = particleTRef.current;
    const particlePosAttr = particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const particleArray = particlePosAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      tValues[i] = (tValues[i] + delta * 0.5) % 1.0;
      const t = tValues[i];
      const omt = 1 - t;
      const pi = i * 3;
      particleArray[pi] = omt * omt * DISH_POS.x + 2 * omt * t * _control.x + t * t * _satPos.x;
      particleArray[pi + 1] = omt * omt * DISH_POS.y + 2 * omt * t * _control.y + t * t * _satPos.y;
      particleArray[pi + 2] = omt * omt * DISH_POS.z + 2 * omt * t * _control.z + t * t * _satPos.z;
    }
    particlePosAttr.needsUpdate = true;
    (particles.material as THREE.PointsMaterial).opacity = 0.7 * opacity;

    // Update satellite-to-ground-station beam
    const nearestGS = findNearestGS3D(_satPos);
    const gsPosAttr = gsBeamLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    writeCurvePoints(_satPos, nearestGS, 1.2, gsPosAttr.array as Float32Array, BEAM_SEGMENTS);
    gsPosAttr.needsUpdate = true;
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
