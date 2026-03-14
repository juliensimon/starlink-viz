'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '@/stores/app-store';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { getPositionsArray, getSatelliteCount, getSatelliteName, setConnectedGroundStation } from '@/lib/satellites/satellite-store';
import { geodeticToCartesian } from '@/lib/utils/coordinates';
import { GROUND_STATIONS } from '@/lib/satellites/ground-stations';
import { DISH_POS, computeAzEl, azElToDirection } from '@/lib/utils/dish-frame';
import { computeGeometricLatency } from '@/lib/utils/geometric-latency';
import { MAX_STEERING_DEG, MIN_ELEVATION_DEG, EARTH_RADIUS_KM, MIN_OPERATIONAL_ALT_KM, MAX_OPERATIONAL_ALT_KM } from '@/lib/config';

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const DISH_VEC = new THREE.Vector3(DISH_POS.x, DISH_POS.y, DISH_POS.z);

const PARTICLE_COUNT = 60;
const BEAM_SEGMENTS = 50;
const BEAM_VERTS = BEAM_SEGMENTS + 1;

// Precompute ground station 3D positions
const gsPositions = GROUND_STATIONS.map((gs) => {
  const { x, y, z } = geodeticToCartesian(degToRad(gs.lat), degToRad(gs.lon), 0, 1);
  return new THREE.Vector3(x, y, z);
});

// Indices of operational stations only — planned/under-construction stations
// are excluded from gateway selection routing.
const operationalGSIndices = GROUND_STATIONS
  .map((gs, i) => (gs.status !== 'planned' ? i : -1))
  .filter((i) => i >= 0);

// Reusable temp vectors
const _satPos = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _control = new THREE.Vector3();

let lastGSIndex = -1;
let lastComputedLatencyMs = 0;

// Find the nearest ground station to the satellite, with hysteresis to
// prevent rapid flickering between two equidistant stations. When a new
// GS is selected, logs a gateway-switch event with the latency delta.
function findNearestGS3D(satPos: THREE.Vector3): THREE.Vector3 {
  let nearest = gsPositions[operationalGSIndices[0]];
  let nearestIdx = operationalGSIndices[0];
  let minDist = Infinity;
  for (const i of operationalGSIndices) {
    const d = satPos.distanceToSquared(gsPositions[i]);
    if (d < minDist) {
      minDist = d;
      nearest = gsPositions[i];
      nearestIdx = i;
    }
  }
  // Hysteresis: only switch if the new GS is >5% closer than the current one,
  // preventing jitter when two stations are nearly equidistant.
  if (lastGSIndex >= 0 && nearestIdx !== lastGSIndex) {
    const currentDist = satPos.distanceToSquared(gsPositions[lastGSIndex]);
    if (minDist > currentDist * 0.95) {
      return gsPositions[lastGSIndex]; // keep current — not meaningfully closer
    }
  }

  if (nearestIdx !== lastGSIndex) {
    const prevName = lastGSIndex >= 0 ? GROUND_STATIONS[lastGSIndex].name : null;
    lastGSIndex = nearestIdx;
    const newName = GROUND_STATIONS[nearestIdx].name;
    setConnectedGroundStation(newName);

    // Log a latency-delta event so the user sees the impact of the switch
    if (prevName) {
      const newLatency = computeGeometricLatency(DISH_VEC, satPos, gsPositions[nearestIdx]);
      const delta = newLatency - lastComputedLatencyMs;
      const sign = delta >= 0 ? '+' : '';
      lastComputedLatencyMs = newLatency;

      useTelemetryStore.getState().addEvent({
        timestamp: Date.now(),
        message: `Gateway switch: ${prevName} \u2192 ${newName} (${sign}${Math.round(delta)}ms)`,
        type: 'warning',
      });
    }
  }
  return nearest;
}

// Total one-way geometric path length in unit-sphere units: dish-to-sat
// plus sat-to-nearest-GS. Used as a latency proxy when ranking satellites
// with similar boresight alignment (lower path = lower latency).
function totalPathLength(x: number, y: number, z: number): number {
  const dxD = x - DISH_VEC.x, dyD = y - DISH_VEC.y, dzD = z - DISH_VEC.z;
  const distDish = Math.sqrt(dxD * dxD + dyD * dyD + dzD * dzD);
  let minGS = Infinity;
  for (const i of operationalGSIndices) {
    const dxG = x - gsPositions[i].x, dyG = y - gsPositions[i].y, dzG = z - gsPositions[i].z;
    const d = Math.sqrt(dxG * dxG + dyG * dyG + dzG * dzG);
    if (d < minGS) minGS = d;
  }
  return distDish + minGS;
}

const cosMaxSteer = Math.cos(degToRad(MAX_STEERING_DEG));

/**
 * Find the best satellite within the antenna's steering cone.
 * Only considers satellites within MAX_STEERING_DEG of the physical boresight.
 */
function findBestSatellite(currentIdx: number | null): {
  index: number | null;
  az: number;
  el: number;
} {
  const positions = getPositionsArray();
  const count = getSatelliteCount();
  if (!positions || count === 0) return { index: null, az: 0, el: 0 };

  const store = useTelemetryStore.getState();
  const boresightAz = store.dishStatus?.antennaBoresightAz ?? -40;
  const boresightEl = store.dishStatus?.antennaBoresightEl ?? 70;
  const boresightDir = azElToDirection(boresightAz, boresightEl);

  let bestIdx = -1;
  let bestDot = -1;
  let bestPath = Infinity;
  let bestAz = 0;

  let currentAz = 0;
  let currentEl = -90;
  let currentInCone = false;

  for (let i = 0; i < count; i++) {
    const pi = i * 3;
    const x = positions[pi];
    const y = positions[pi + 1];
    const z = positions[pi + 2];
    if (x === 0 && y === 0 && z === 0) continue;

    // Skip non-operational satellites (orbit-raising or deorbiting)
    const posLen = Math.sqrt(x * x + y * y + z * z);
    const altKm = (posLen - 1) * EARTH_RADIUS_KM;
    if (altKm < MIN_OPERATIONAL_ALT_KM || altKm > MAX_OPERATIONAL_ALT_KM) continue;

    const { az, el } = computeAzEl(x, y, z);
    if (el <= MIN_ELEVATION_DEG) continue;

    // Check if satellite is within the antenna's steering cone
    const satDir = azElToDirection(az, el);
    const dot = boresightDir.x * satDir.x + boresightDir.y * satDir.y + boresightDir.z * satDir.z;
    if (dot < cosMaxSteer) continue;

    if (i === currentIdx) {
      currentAz = az;
      currentEl = el;
      currentInCone = true;
    }

    if (dot > bestDot + 0.01) {
      // Clearly better alignment — always pick
      bestDot = dot;
      bestPath = totalPathLength(x, y, z);
      bestIdx = i;
      bestAz = az;
    } else if (dot > bestDot - 0.001) {
      // Similar alignment — prefer shorter total path (lower latency)
      const path = totalPathLength(x, y, z);
      if (path < bestPath) {
        bestDot = dot;
        bestPath = path;
        bestIdx = i;
        bestAz = az;
      }
    }
  }

  if (currentIdx !== null && currentInCone && currentEl > MIN_ELEVATION_DEG) {
    return { index: currentIdx, az: currentAz, el: currentEl };
  }

  if (bestIdx >= 0) {
    const pi = bestIdx * 3;
    const { el: bestEl } = computeAzEl(positions[pi], positions[pi + 1], positions[pi + 2]);
    return { index: bestIdx, az: bestAz, el: bestEl };
  }
  return { index: null, az: 0, el: 0 };
}

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

export default function ConnectionBeam() {
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const setConnectedSatellite = useAppStore((s) => s.setConnectedSatellite);

  const beamLine = useMemo(() => {
    const posArray = new Float32Array(BEAM_VERTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#00ffff'),
      transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, []);

  const gsBeamLine = useMemo(() => {
    const posArray = new Float32Array(BEAM_VERTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#ff9933'),
      transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, []);

  const particles = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color('#00ffff'), size: 0.006,
      transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
  }, []);

  const gsParticles = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color('#ff9933'), size: 0.006,
      transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
  }, []);

  const particleTRef = useRef(new Float32Array(PARTICLE_COUNT));
  const gsParticleTRef = useRef(new Float32Array(PARTICLE_COUNT));

  const opacityRef = useRef(1);
  const prevConnectedRef = useRef<number | null>(null);
  const handoffTimeRef = useRef(0);
  const isHandingOffRef = useRef(false);

  // Track last az/el to avoid unnecessary store updates (C3 fix)
  const lastAzRef = useRef(0);
  const lastElRef = useRef(0);

  useEffect(() => {
    lastGSIndex = -1;
    lastComputedLatencyMs = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particleTRef.current[i] = i / PARTICLE_COUNT;
      gsParticleTRef.current[i] = i / PARTICLE_COUNT;
    }
    return () => {
      lastGSIndex = -1;
      lastComputedLatencyMs = 0;
    };
  }, []);

  // Detect handoff — trigger animation and log event
  useEffect(() => {
    if (
      prevConnectedRef.current !== null &&
      connectedSatelliteIndex !== null &&
      prevConnectedRef.current !== connectedSatelliteIndex
    ) {
      isHandingOffRef.current = true;
      handoffTimeRef.current = 0;
      opacityRef.current = 0;

      const prevName = getSatelliteName(prevConnectedRef.current);
      const newName = getSatelliteName(connectedSatelliteIndex);
      const positions = getPositionsArray();
      const { az, el } = positions
        ? computeAzEl(positions[connectedSatelliteIndex * 3], positions[connectedSatelliteIndex * 3 + 1], positions[connectedSatelliteIndex * 3 + 2])
        : { az: 0, el: 0 };

      // Compute latency delta (new sat vs previous sat through same GS)
      // to show the user how much the handoff affected round-trip time.
      let latencyStr = '';
      if (positions && lastGSIndex >= 0) {
        const newSatPos = new THREE.Vector3(
          positions[connectedSatelliteIndex * 3],
          positions[connectedSatelliteIndex * 3 + 1],
          positions[connectedSatelliteIndex * 3 + 2],
        );
        const newLatency = computeGeometricLatency(DISH_VEC, newSatPos, gsPositions[lastGSIndex]);
        const delta = newLatency - lastComputedLatencyMs;
        const sign = delta >= 0 ? '+' : '';
        lastComputedLatencyMs = newLatency;
        latencyStr = `, ${sign}${Math.round(delta)}ms`;
      }

      useTelemetryStore.getState().addEvent({
        timestamp: Date.now(),
        message: `Handoff: ${prevName} \u2192 ${newName} (az ${az.toFixed(1)}\u00B0, el ${el.toFixed(1)}\u00B0${latencyStr})`,
        type: 'success',
      });
    }
    prevConnectedRef.current = connectedSatelliteIndex;
  }, [connectedSatelliteIndex]);

  const lastSelectionRef = useRef(0);
  const lastLatencyRef = useRef(0);

  useFrame((_, delta) => {
    const positions = getPositionsArray();
    if (!positions) return;

    // Update satellite selection every 500ms
    const now = performance.now();
    if (now - lastSelectionRef.current > 500) {
      lastSelectionRef.current = now;

      // Same logic for both demo and live mode — dish doesn't expose
      // active beam direction, only physical antenna orientation.
      const result = findBestSatellite(connectedSatelliteIndex);
      if (result.index !== null) {
        if (result.index !== connectedSatelliteIndex) {
          setConnectedSatellite(result.index);
        }

        // Only update store when az/el actually changed (C3 fix)
        const azRounded = Math.round(result.az * 100) / 100;
        const elRounded = Math.round(result.el * 100) / 100;
        if (azRounded !== lastAzRef.current || elRounded !== lastElRef.current) {
          lastAzRef.current = azRounded;
          lastElRef.current = elRounded;
          const store = useTelemetryStore.getState();
          if (store.dishStatus) {
            store.updateStatus({
              ...store.dishStatus,
              azimuth: azRounded,
              elevation: elRounded,
            });
          }
        }
      }
    }

    // Render beams
    const currentIdx = useAppStore.getState().connectedSatelliteIndex;
    if (currentIdx === null) return;

    const pi = currentIdx * 3;
    _satPos.set(positions[pi], positions[pi + 1], positions[pi + 2]);
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

    // Dish → satellite beam
    const beamPosAttr = beamLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    writeCurvePoints(DISH_VEC, _satPos, 1.3, beamPosAttr.array as Float32Array, BEAM_SEGMENTS);
    beamPosAttr.needsUpdate = true;
    (beamLine.material as THREE.LineBasicMaterial).opacity = 0.4 * opacity;

    // Uplink particles
    const tValues = particleTRef.current;
    const particlePosAttr = particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const particleArray = particlePosAttr.array as Float32Array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      tValues[i] = (tValues[i] + delta * 0.5) % 1.0;
      const t = tValues[i];
      const omt = 1 - t;
      const pIdx = i * 3;
      particleArray[pIdx] = omt * omt * DISH_VEC.x + 2 * omt * t * _control.x + t * t * _satPos.x;
      particleArray[pIdx + 1] = omt * omt * DISH_VEC.y + 2 * omt * t * _control.y + t * t * _satPos.y;
      particleArray[pIdx + 2] = omt * omt * DISH_VEC.z + 2 * omt * t * _control.z + t * t * _satPos.z;
    }
    particlePosAttr.needsUpdate = true;
    (particles.material as THREE.PointsMaterial).opacity = 0.7 * opacity;

    // Satellite → ground station beam
    const nearestGS = findNearestGS3D(_satPos);
    const gsPosAttr = gsBeamLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    writeCurvePoints(_satPos, nearestGS, 1.2, gsPosAttr.array as Float32Array, BEAM_SEGMENTS);
    gsPosAttr.needsUpdate = true;
    (gsBeamLine.material as THREE.LineBasicMaterial).opacity = 0.6 * opacity;

    // Downlink particles
    const gsTValues = gsParticleTRef.current;
    const gsParticlePosAttr = gsParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const gsParticleArray = gsParticlePosAttr.array as Float32Array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      gsTValues[i] = (gsTValues[i] + delta * 0.5) % 1.0;
      const t = gsTValues[i];
      const omt = 1 - t;
      const pIdx = i * 3;
      gsParticleArray[pIdx] = omt * omt * _satPos.x + 2 * omt * t * _control.x + t * t * nearestGS.x;
      gsParticleArray[pIdx + 1] = omt * omt * _satPos.y + 2 * omt * t * _control.y + t * t * nearestGS.y;
      gsParticleArray[pIdx + 2] = omt * omt * _satPos.z + 2 * omt * t * _control.z + t * t * nearestGS.z;
    }
    gsParticlePosAttr.needsUpdate = true;
    (gsParticles.material as THREE.PointsMaterial).opacity = 0.7 * opacity;

    // Compute geometry-based latency every 1s.
    // In demo mode: overrides ping. In live mode: stored for cross-validation.
    if (now - lastLatencyRef.current > 1000) {
      lastLatencyRef.current = now;
      const geoLatency = computeGeometricLatency(DISH_VEC, _satPos, nearestGS);
      lastComputedLatencyMs = geoLatency;
      const store = useTelemetryStore.getState();
      store.setGeometricLatency(geoLatency);
      if (useAppStore.getState().demoMode && store.dishStatus) {
        store.updateStatus({
          ...store.dishStatus,
          ping: Math.round(geoLatency * 100) / 100,
        });
      }
    }
  });

  if (connectedSatelliteIndex === null) return null;

  return (
    <group>
      <primitive object={beamLine} />
      <primitive object={particles} />
      <primitive object={gsBeamLine} />
      <primitive object={gsParticles} />
    </group>
  );
}
