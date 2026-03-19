'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getPositionsArray,
  getInclinationsArray,
  getSatelliteCount,
} from '@/lib/satellites/satellite-store';
import { useAppStore } from '@/stores/app-store';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { DISH_POS, azElToDirection } from '@/lib/utils/dish-frame';
import { MAX_STEERING_DEG, EARTH_RADIUS_KM, MIN_OPERATIONAL_ALT_KM, MAX_OPERATIONAL_ALT_KM } from '@/lib/config';
import { getDimColor, CONE_COLOR, BRIGHT_COLOR } from '@/lib/utils/shell-colors';

const MAX_STEER_COS = Math.cos((MAX_STEERING_DEG * Math.PI) / 180);

const NUM_BATCHES = 6;
const MIN_OPERATIONAL_ALT = MIN_OPERATIONAL_ALT_KM;
const MAX_OPERATIONAL_ALT = MAX_OPERATIONAL_ALT_KM;
const COLOR_UPDATE_INTERVAL_MS = 100;
const MAX_SATELLITES = 10000;

const tempObject = new THREE.Object3D();

/**
 * Pure renderer for space-view satellites.
 * Reads positions from satellite-store (written by SatellitePropagator).
 * Handles occlusion culling, matrix transforms, and color updates.
 */
export default function Satellites() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const batchIndexRef = useRef(0);
  const colorsRef = useRef<Float32Array | null>(null);
  const colorUpdateRef = useRef(0);
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const satellitesLoaded = useAppStore((s) => s.satellitesLoaded);
  const satellitesVersion = useAppStore((s) => s.satellitesVersion);
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

  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, MAX_SATELLITES);
    m.frustumCulled = false;
    const buf = new Float32Array(MAX_SATELLITES * 3).fill(1);
    m.instanceColor = new THREE.InstancedBufferAttribute(buf, 3);
    return m;
  }, [geometry, material]);

  useEffect(() => { meshRef.current = mesh; }, [mesh]);

  // Initialize mesh when satellite-store is populated by SatellitePropagator
  useEffect(() => {
    if (!satellitesLoaded) return;

    const positions = getPositionsArray();
    const inclinations = getInclinationsArray();
    if (!positions || !inclinations) return;

    const count = getSatelliteCount();
    mesh.count = count;

    // Write shell colors
    const colorArr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    for (let i = 0; i < count; i++) {
      const dim = getDimColor(inclinations[i]);
      colorArr[i * 3] = dim.r;
      colorArr[i * 3 + 1] = dim.g;
      colorArr[i * 3 + 2] = dim.b;
    }
    (mesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    colorsRef.current = colorArr;

    // Set initial positions
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      tempObject.position.set(positions[idx], positions[idx + 1], positions[idx + 2]);
      tempObject.scale.setScalar(1);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [satellitesLoaded, satellitesVersion, mesh]);

  // Update connected satellite color
  const prevConnectedRef = useRef<number | null>(null);
  useEffect(() => {
    const colors = colorsRef.current;
    const m = meshRef.current;
    if (!colors || !m || !m.instanceColor) return;

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

    (m.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    prevConnectedRef.current = connectedSatelliteIndex;
  }, [connectedSatelliteIndex]);

  // Per-frame: read positions, apply occlusion + matrix updates, periodic color update
  const updateBatch = useCallback(() => {
    const positions = getPositionsArray();
    const m = meshRef.current;
    if (!positions || !m) return;

    const count = getSatelliteCount();
    if (count === 0) return;

    const colors = colorsRef.current;
    const connectedIdx = useAppStore.getState().connectedSatelliteIndex;

    const batchSize = Math.ceil(count / NUM_BATCHES);
    const batchIdx = batchIndexRef.current;
    const startIdx = batchIdx * batchSize;
    const batchCount = Math.min(batchSize, count - startIdx);

    // Camera occlusion
    const camLen = camera.position.length();
    const camNormX = camera.position.x / camLen;
    const camNormY = camera.position.y / camLen;
    const camNormZ = camera.position.z / camLen;

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
      m.setMatrixAt(i, tempObject.matrix);
    }

    const attr = m.instanceMatrix;
    attr.clearUpdateRanges();
    attr.addUpdateRange(startIdx * 16, batchCount * 16);
    attr.needsUpdate = true;

    // Periodic color update
    const nowMs = performance.now();
    if (colors && m.instanceColor && nowMs - colorUpdateRef.current >= COLOR_UPDATE_INTERVAL_MS) {
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

      (m.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }

    batchIndexRef.current = (batchIdx + 1) % NUM_BATCHES;
  }, [camera]);

  useFrame(updateBatch);

  if (!satellitesLoaded) return null;

  return (
    <primitive object={mesh} />
  );
}
