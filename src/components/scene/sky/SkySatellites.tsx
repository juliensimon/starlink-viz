'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getPositionsArray,
  getInclinationsArray,
  getSatelliteCount,
} from '@/lib/satellites/satellite-store';
import { useAppStore } from '@/stores/app-store';
import { computeObserverFrame } from '@/lib/utils/observer-frame';
import { getDimColor, BRIGHT_COLOR } from '@/lib/utils/shell-colors';
import { isSatelliteSunlit } from '@/lib/utils/sun-shadow';
import { getSunDirection } from '@/lib/utils/astronomy';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

const DOME_RADIUS = 2.0;
const MAX_SATELLITES = 10000;
const NUM_BATCHES = 6;
const COLOR_UPDATE_INTERVAL_MS = 100;

const tempObject = new THREE.Object3D();

export default function SkySatellites() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const batchIndexRef = useRef(0);
  const colorsRef = useRef<Float32Array | null>(null);
  const colorUpdateRef = useRef(0);
  // Per-satellite color state (0 = shadow, 1 = sunlit, 2 = connected) so the
  // periodic color pass uploads only the instances that actually changed.
  const colorStatesRef = useRef<Uint8Array | null>(null);

  const satellitesLoaded = useAppStore((s) => s.satellitesLoaded);
  const satellitesVersion = useAppStore((s) => s.satellitesVersion);
  const demoLocation = useAppStore((s) => s.demoLocation);

  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;

  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.015, 1), []);
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

  // Initialize mesh when data is ready
  useEffect(() => {
    if (!satellitesLoaded) return;
    const count = getSatelliteCount();
    mesh.count = count;

    const colorArr = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    const inclinations = getInclinationsArray();
    for (let i = 0; i < count; i++) {
      const inc = inclinations ? inclinations[i] : 53;
      const dim = getDimColor(inc);
      colorArr[i * 3] = dim.r;
      colorArr[i * 3 + 1] = dim.g;
      colorArr[i * 3 + 2] = dim.b;
    }
    const initColorAttr = mesh.instanceColor as THREE.InstancedBufferAttribute;
    initColorAttr.clearUpdateRanges(); // full upload — drop any narrow range left by the color pass
    initColorAttr.needsUpdate = true;
    colorsRef.current = colorArr;
    colorStatesRef.current = null; // force the color pass to re-derive sunlit state
  }, [satellitesLoaded, satellitesVersion, mesh]);

  // Per-frame: project satellites onto dome using az/el
  const updateBatch = useCallback(() => {
    const positions = getPositionsArray();
    const m = meshRef.current;
    if (!positions || !m) return;

    const count = getSatelliteCount();
    if (count === 0) return;

    const batchSize = Math.ceil(count / NUM_BATCHES);
    const batchIdx = batchIndexRef.current;
    const startIdx = batchIdx * batchSize;
    const batchCount = Math.min(batchSize, count - startIdx);
    const batchEnd = Math.min(startIdx + batchCount, count);

    for (let i = startIdx; i < batchEnd; i++) {
      const idx = i * 3;
      const x = positions[idx];
      const y = positions[idx + 1];
      const z = positions[idx + 2];

      if (x === 0 && y === 0 && z === 0) {
        tempObject.scale.setScalar(0);
        tempObject.position.set(0, 0, 0);
        tempObject.updateMatrix();
        m.setMatrixAt(i, tempObject.matrix);
        continue;
      }

      // The dome direction is just the normalized observer→satellite vector;
      // computeAzElFrom → azElToDirection3D round-tripped to this exact
      // vector at ~6 trig calls + 2 allocations per satellite per frame.
      const dx = x - frame.pos.x;
      const dy = y - frame.pos.y;
      const dz = z - frame.pos.z;
      const dLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Below horizon (dot with up-normal < 0) — hide
      const sinEl = dLen < 1e-10 ? -1 : (dx * frame.normal.x + dy * frame.normal.y + dz * frame.normal.z) / dLen;

      if (sinEl < 0) {
        tempObject.scale.setScalar(0);
        tempObject.position.set(0, 0, 0);
        tempObject.updateMatrix();
        m.setMatrixAt(i, tempObject.matrix);
        continue;
      }

      // Project onto dome
      const s = DOME_RADIUS / dLen;
      tempObject.position.set(
        frame.pos.x + dx * s,
        frame.pos.y + dy * s,
        frame.pos.z + dz * s
      );
      tempObject.scale.setScalar(1);
      tempObject.updateMatrix();
      m.setMatrixAt(i, tempObject.matrix);
    }

    const attr = m.instanceMatrix;
    attr.clearUpdateRanges();
    attr.addUpdateRange(startIdx * 16, batchCount * 16);
    attr.needsUpdate = true;

    // Periodic color update — sun shadow + connected highlight
    const nowMs = performance.now();
    const colors = colorsRef.current;
    if (colors && m.instanceColor && nowMs - colorUpdateRef.current >= COLOR_UPDATE_INTERVAL_MS) {
      colorUpdateRef.current = nowMs;
      const connectedIdx = useAppStore.getState().connectedSatelliteIndex;
      const inclinations = getInclinationsArray();

      const sunDir = getSunDirection(new Date());
      const sdx = sunDir.x, sdy = sunDir.y, sdz = sunDir.z;

      // Sunlit/shadow state changes slowly — write (and upload) only flips.
      let states = colorStatesRef.current;
      if (!states || states.length !== count) {
        states = new Uint8Array(count).fill(255); // 255 = unknown, forces first write
        colorStatesRef.current = states;
      }
      let minDirty = Infinity;
      let maxDirty = -1;

      for (let i = 0; i < count; i++) {
        const ci = i * 3;
        let newState: number;
        if (i === connectedIdx) {
          newState = 2;
        } else {
          // Check if satellite is in Earth's shadow
          const sx = positions[ci], sy = positions[ci + 1], sz = positions[ci + 2];
          const sunlit = sx === 0 && sy === 0 && sz === 0
            ? true
            : isSatelliteSunlit(sx, sy, sz, sdx, sdy, sdz);
          newState = sunlit ? 1 : 0;
        }
        if (states[i] === newState) continue;
        states[i] = newState;

        if (newState === 2) {
          colors[ci] = BRIGHT_COLOR.r;
          colors[ci + 1] = BRIGHT_COLOR.g;
          colors[ci + 2] = BRIGHT_COLOR.b;
        } else {
          const inc = inclinations ? inclinations[i] : 53;
          const dim = getDimColor(inc);
          const brightness = newState === 1 ? 1.0 : 0.1;
          colors[ci] = dim.r * brightness;
          colors[ci + 1] = dim.g * brightness;
          colors[ci + 2] = dim.b * brightness;
        }
        if (ci < minDirty) minDirty = ci;
        if (ci + 3 > maxDirty) maxDirty = ci + 3;
      }

      if (maxDirty >= 0) {
        const colorAttr = m.instanceColor as THREE.InstancedBufferAttribute;
        colorAttr.clearUpdateRanges();
        colorAttr.addUpdateRange(minDirty, maxDirty - minDirty);
        colorAttr.needsUpdate = true;
      }
    }

    batchIndexRef.current = (batchIdx + 1) % NUM_BATCHES;
  }, [frame]);

  useFrame(updateBatch);

  if (!satellitesLoaded) return null;

  return <primitive object={mesh} />;
}
