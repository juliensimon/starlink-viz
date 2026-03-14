'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSatellites } from '@/hooks/useSatellites';
import { initSatelliteRecords, propagateBatch, propagateSingle } from '@/lib/satellites/propagator';
import {
  setTLEData,
  setSatrecObjects,
  setPositionsArray,
  setConnectedOrbitalData,
  setInclinationsArray,
  getInclinationsArray,
  setFullCatalog,
} from '@/lib/satellites/satellite-store';
import { useAppStore } from '@/stores/app-store';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { DISH_POS, azElToDirection } from '@/lib/utils/dish-frame';
import { MAX_STEERING_DEG, EARTH_RADIUS_KM, MIN_OPERATIONAL_ALT_KM, MAX_OPERATIONAL_ALT_KM, isOperationalAltitude } from '@/lib/config';
import type { SatRec } from '@/lib/satellites/propagator';

const MAX_STEER_COS = Math.cos((MAX_STEERING_DEG * Math.PI) / 180);

const NUM_BATCHES = 6;
const DIM_BLUE = new THREE.Color('#6699ff');     // 53° main shell
const DIM_ORANGE = new THREE.Color('#ff8844');   // 43° shell
const DIM_YELLOW = new THREE.Color('#eecc22');   // 33° shell — warm gold, distinct from green
const DIM_GREEN = new THREE.Color('#22ddbb');    // 70° shell — teal-green, well away from yellow
const DIM_RED = new THREE.Color('#ff4466');      // 97.6° polar shell
const CONE_COLOR = new THREE.Color('#dd55ff');
const BRIGHT_COLOR = new THREE.Color('#ff3366');

const MIN_OPERATIONAL_ALT = MIN_OPERATIONAL_ALT_KM;
const MAX_OPERATIONAL_ALT = MAX_OPERATIONAL_ALT_KM;
const COLOR_UPDATE_INTERVAL_MS = 100;

// Pre-allocate max constellation size to avoid mesh recreation
const MAX_SATELLITES = 10000;

const tempObject = new THREE.Object3D();

// Map orbital inclination to a shell color. NaN falls through to the
// default (DIM_BLUE / 53-deg shell) since NaN fails all >= comparisons.
function getDimColor(inclination: number): THREE.Color {
  if (inclination >= 80) return DIM_RED;      // 97.6° polar
  if (inclination >= 60) return DIM_GREEN;    // 70° shell
  if (inclination >= 48) return DIM_BLUE;     // 53° main shell
  if (inclination >= 38) return DIM_ORANGE;   // 43° shell
  return DIM_YELLOW;                          // 33° shell
}

export default function Satellites() {
  const { tleData, loading } = useSatellites();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const satrecsRef = useRef<SatRec[]>([]);
  const positionsRef = useRef<Float32Array | null>(null);
  const batchIndexRef = useRef(0);
  const countRef = useRef(0);
  const colorsRef = useRef<Float32Array | null>(null);
  const colorUpdateRef = useRef(0);
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const altitudeFilter = useAppStore((s) => s.altitudeFilter);
  const { camera } = useThree();

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.004, 1), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
          #endif
          varying vec3 vIColor;
          void main() {
            vIColor = instanceColor;
            vec4 pos = vec4(position, 1.0);
            #ifdef USE_INSTANCING
              pos = instanceMatrix * pos;
            #endif
            gl_Position = projectionMatrix * modelViewMatrix * pos;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vIColor;
          void main() {
            gl_FragColor = vec4(vIColor, 1.0);
            #include <colorspace_fragment>
          }
        `,
        toneMapped: false,
      }),
    []
  );

  // Build the InstancedMesh once with instanceColor pre-attached so the very
  // first shader compile (in every browser) includes USE_INSTANCING_COLOR.
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, MAX_SATELLITES);
    m.frustumCulled = false;
    // Pre-allocate instanceColor filled with white
    const buf = new Float32Array(MAX_SATELLITES * 3).fill(1);
    m.instanceColor = new THREE.InstancedBufferAttribute(buf, 3);
    return m;
  }, [geometry, material]);

  // Keep meshRef in sync
  useEffect(() => { meshRef.current = mesh; }, [mesh]);

  // Initialize satrecs when TLE data arrives or filter changes
  useEffect(() => {
    if (!tleData || tleData.length === 0) return;

    const totalCount = tleData.length;
    const allSatrecs = initSatelliteRecords(tleData);

    const now = new Date();

    // Propagate all satellites once to get altitudes (used for both
    // the full catalog snapshot and the altitude filter).
    const allInclinations = new Float32Array(totalCount);
    const allAltitudes = new Float32Array(totalCount);
    for (let i = 0; i < totalCount; i++) {
      const inc = parseFloat(tleData[i].line2.substring(8, 16));
      allInclinations[i] = isNaN(inc) ? 53 : inc;
      const data = propagateSingle(allSatrecs[i], now);
      allAltitudes[i] = data ? data.altitudeKm : 0;
    }
    setFullCatalog(totalCount, allInclinations, allAltitudes);

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

    // Parse inclinations directly from TLE line2 (columns 8-16) rather than
    // relying on a parsed JSON field, because stale browser caches may serve
    // API responses that lack the inclination property.
    const inclinations = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const tle = filteredTle[i];
      const inc = parseFloat(tle.line2.substring(8, 16));
      inclinations[i] = isNaN(inc) ? 53 : inc;
    }
    setInclinationsArray(inclinations);

    // Initial propagation
    propagateBatch(filteredSatrecs, now, 0, count, posArr);

    // Configure mesh
    mesh.count = count;

    // Write shell colors into the pre-allocated instanceColor buffer
    const colorArr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    for (let i = 0; i < count; i++) {
      const dim = getDimColor(inclinations[i]);
      colorArr[i * 3] = dim.r;
      colorArr[i * 3 + 1] = dim.g;
      colorArr[i * 3 + 2] = dim.b;
    }
    (mesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    colorsRef.current = colorArr;

    // Set positions
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      tempObject.position.set(posArr[idx], posArr[idx + 1], posArr[idx + 2]);
      tempObject.scale.setScalar(1);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    console.log(`Loaded ${count} satellites`);
    useAppStore.getState().setSatellitesLoaded(true);
  }, [tleData, altitudeFilter, mesh]);

  // Update connected satellite color
  const prevConnectedRef = useRef<number | null>(null);
  useEffect(() => {
    const colors = colorsRef.current;
    const mesh = meshRef.current;
    if (!colors || !mesh || !mesh.instanceColor) return;

    if (prevConnectedRef.current !== null) {
      const pi = prevConnectedRef.current * 3;
      const inclinations = getInclinationsArray();
      const inc = inclinations ? inclinations[prevConnectedRef.current] : 53;
      const dim = getDimColor(inc);
      colors[pi] = dim.r;
      colors[pi + 1] = dim.g;
      colors[pi + 2] = dim.b;
    }

    if (connectedSatelliteIndex !== null) {
      const ci = connectedSatelliteIndex * 3;
      colors[ci] = BRIGHT_COLOR.r;
      colors[ci + 1] = BRIGHT_COLOR.g;
      colors[ci + 2] = BRIGHT_COLOR.b;
    }

    (mesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    prevConnectedRef.current = connectedSatelliteIndex;
  }, [connectedSatelliteIndex]);

  // Update connected satellite orbital data
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

  // Per-frame batched propagation, occlusion, and periodic color update
  const updateBatch = useCallback(() => {
    const satrecs = satrecsRef.current;
    const positions = positionsRef.current;
    const mesh = meshRef.current;
    const count = countRef.current;

    if (!satrecs.length || !positions || !mesh || count === 0) return;

    const colors = colorsRef.current;
    const connectedIdx = useAppStore.getState().connectedSatelliteIndex;

    const now = new Date();
    const batchSize = Math.ceil(count / NUM_BATCHES);
    const batchIdx = batchIndexRef.current;
    const startIdx = batchIdx * batchSize;
    const batchCount = Math.min(batchSize, count - startIdx);

    if (batchCount > 0) {
      propagateBatch(satrecs, now, startIdx, batchCount, positions);
    }

    // Camera occlusion: hide satellites on the far side of the globe by
    // checking if the sat-to-camera dot product is strongly negative.
    // Uses the current batch range so work is spread across frames.
    const camLen = camera.position.length();
    const camNormX = camera.position.x / camLen;
    const camNormY = camera.position.y / camLen;
    const camNormZ = camera.position.z / camLen;

    // Iterate over the same batch range used for propagation above, so each
    // satellite's matrix is updated in the same frame its position changed.
    const batchEnd = Math.min(startIdx + batchCount, count);
    for (let i = startIdx; i < batchEnd; i++) {
      const idx = i * 3;
      const x = positions[idx];
      const y = positions[idx + 1];
      const z = positions[idx + 2];

      tempObject.position.set(x, y, z);

      let hide = x === 0 && y === 0 && z === 0;
      if (!hide) {
        const posLen = Math.sqrt(x * x + y * y + z * z);
        const dot = (x * camNormX + y * camNormY + z * camNormZ) / posLen;
        hide = dot < -0.3;
      }
      tempObject.scale.setScalar(hide ? 0 : 1);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }

    const attr = mesh.instanceMatrix;
    attr.clearUpdateRanges();
    attr.addUpdateRange(startIdx * 16, batchCount * 16);
    attr.needsUpdate = true;

    // Periodic color update
    const nowMs = performance.now();
    if (colors && mesh.instanceColor && nowMs - colorUpdateRef.current >= COLOR_UPDATE_INTERVAL_MS) {
      colorUpdateRef.current = nowMs;

      const inclinations = getInclinationsArray();

      const store = useTelemetryStore.getState();
      const boresightDir = azElToDirection(
        store.dishStatus?.antennaBoresightAz ?? -40,
        store.dishStatus?.antennaBoresightEl ?? 70
      );
      const boreX = boresightDir.x;
      const boreY = boresightDir.y;
      const boreZ = boresightDir.z;

      for (let i = 0; i < count; i++) {
        if (i === connectedIdx) continue;

        const idx = i * 3;
        const x = positions[idx];
        const y = positions[idx + 1];
        const z = positions[idx + 2];

        const dx = x - DISH_POS.x;
        const dy = y - DISH_POS.y;
        const dz = z - DISH_POS.z;
        const dLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dLen > 0.001) {
          // Only consider operational satellites for steering cone
          const posLen = Math.sqrt(x * x + y * y + z * z);
          const altKm = (posLen - 1) * EARTH_RADIUS_KM;
          const operational = altKm >= MIN_OPERATIONAL_ALT && altKm <= MAX_OPERATIONAL_ALT;

          const sdx = dx / dLen, sdy = dy / dLen, sdz = dz / dLen;
          const bDot = sdx * boreX + sdy * boreY + sdz * boreZ;
          const ci = i * 3;
          if (operational && bDot > MAX_STEER_COS) {
            colors[ci] = CONE_COLOR.r;
            colors[ci + 1] = CONE_COLOR.g;
            colors[ci + 2] = CONE_COLOR.b;
          } else {
            const inc = inclinations ? inclinations[i] : 53;
            const dim = getDimColor(inc);
            colors[ci] = dim.r;
            colors[ci + 1] = dim.g;
            colors[ci + 2] = dim.b;
          }
        }
      }

      (mesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }

    batchIndexRef.current = (batchIdx + 1) % NUM_BATCHES;
  }, [camera]);

  useFrame(updateBatch);

  if (loading || !tleData) return null;

  return (
    <primitive object={mesh} />
  );
}
