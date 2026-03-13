'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSatellites } from '@/hooks/useSatellites';
import { initSatelliteRecords, propagateBatch } from '@/lib/satellites/propagator';
import {
  setTLEData,
  setSatrecObjects,
  setPositionsArray,
} from '@/lib/satellites/satellite-store';
import { useAppStore } from '@/stores/app-store';
import type { SatRec } from '@/lib/satellites/propagator';

// Propagate 1 batch per frame across NUM_BATCHES frames for a full cycle
const NUM_BATCHES = 6;
const DIM_COLOR = new THREE.Color('#1a6b8a');
const BRIGHT_COLOR = new THREE.Color('#00ffff');

// Reusable — never allocate in render loop
const tempObject = new THREE.Object3D();

export default function Satellites() {
  const { tleData, loading } = useSatellites();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const satrecsRef = useRef<SatRec[]>([]);
  const positionsRef = useRef<Float32Array | null>(null);
  const batchIndexRef = useRef(0);
  const countRef = useRef(0);
  const colorsRef = useRef<Float32Array | null>(null);
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const { camera } = useThree();

  // Geometry: minimal icosahedron for each satellite dot
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.003, 0), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: false, color: '#1a6b8a' }),
    []
  );

  // Initialize satrecs when TLE data arrives
  useEffect(() => {
    if (!tleData || tleData.length === 0) return;

    setTLEData(tleData);
    const satrecs = initSatelliteRecords(tleData);
    setSatrecObjects(satrecs);
    satrecsRef.current = satrecs;

    const count = satrecs.length;
    countRef.current = count;
    const posArr = new Float32Array(count * 3);
    positionsRef.current = posArr;
    setPositionsArray(posArr);

    // Initialize colors
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = DIM_COLOR.r;
      colors[i * 3 + 1] = DIM_COLOR.g;
      colors[i * 3 + 2] = DIM_COLOR.b;
    }
    colorsRef.current = colors;

    // Do an initial full propagation
    const now = new Date();
    propagateBatch(satrecs, now, 0, count, positionsRef.current);

    // Set initial transforms
    if (meshRef.current) {
      meshRef.current.count = count;
      const colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
      meshRef.current.instanceColor = colorAttr;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        tempObject.position.set(
          positionsRef.current[idx],
          positionsRef.current[idx + 1],
          positionsRef.current[idx + 2]
        );
        tempObject.scale.setScalar(1);
        tempObject.updateMatrix();
        meshRef.current.setMatrixAt(i, tempObject.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }

    console.log(`Loaded ${count} satellites`);
    useAppStore.getState().setSatellitesLoaded(true);
  }, [tleData]);

  // Update connected satellite color
  const prevConnectedRef = useRef<number | null>(null);
  useEffect(() => {
    const colors = colorsRef.current;
    const mesh = meshRef.current;
    if (!colors || !mesh || !mesh.instanceColor) return;

    if (prevConnectedRef.current !== null) {
      const pi = prevConnectedRef.current * 3;
      colors[pi] = DIM_COLOR.r;
      colors[pi + 1] = DIM_COLOR.g;
      colors[pi + 2] = DIM_COLOR.b;
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

  // Per-frame batched propagation and occlusion
  const updateBatch = useCallback(() => {
    const satrecs = satrecsRef.current;
    const positions = positionsRef.current;
    const mesh = meshRef.current;
    const count = countRef.current;

    if (!satrecs.length || !positions || !mesh || count === 0) return;

    const now = new Date();
    const batchSize = Math.ceil(count / NUM_BATCHES);
    const batchIdx = batchIndexRef.current;
    const startIdx = batchIdx * batchSize;
    const batchCount = Math.min(batchSize, count - startIdx);

    if (batchCount > 0) {
      propagateBatch(satrecs, now, startIdx, batchCount, positions);
    }

    // Camera occlusion direction
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

      const dot = x * camNormX + y * camNormY + z * camNormZ;
      const hide = dot < -0.2 || (x === 0 && y === 0 && z === 0);
      tempObject.scale.setScalar(hide ? 0 : 1);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }

    // Partial buffer update — only upload the modified range, not the full buffer
    const attr = mesh.instanceMatrix;
    attr.clearUpdateRanges();
    attr.addUpdateRange(startIdx * 16, batchCount * 16);
    attr.needsUpdate = true;

    batchIndexRef.current = (batchIdx + 1) % NUM_BATCHES;
  }, [camera]);

  useFrame(updateBatch);

  if (loading || !tleData) return null;

  // Allocate exactly what we need — avoids wasting GPU memory on unused slots
  const instanceCount = tleData.length;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, instanceCount]}
      frustumCulled={false}
    />
  );
}
