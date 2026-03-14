'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import type { TLEData } from '@/lib/satellites/tle-fetcher';

const GPS_COLOR = new THREE.Color('#44ff44');
const tempObject = new THREE.Object3D();

function parseNoradId(line1: string): string {
  return line1.substring(2, 7).trim();
}

function dispatchGpsTooltip(data: { name: string; noradId: string; altitude: string; x: number; y: number } | null) {
  window.dispatchEvent(new CustomEvent('gps-satellite-tooltip', { detail: data }));
}

export default function GpsSatellites() {
  const { camera, gl } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const satrecsRef = useRef<ReturnType<typeof satellite.twoline2satrec>[]>([]);
  const countRef = useRef(0);
  const tleRef = useRef<TLEData[] | null>(null);
  const positionsRef = useRef<Float32Array | null>(null);

  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const needsRaycast = useRef(false);
  const lastTooltipIdx = useRef<number | null>(null);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.015, 1), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: GPS_COLOR }),
    []
  );

  // Fetch GPS TLE data
  useEffect(() => {
    fetch('/api/tle-gps')
      .then((r) => r.json())
      .then((data: TLEData[]) => {
        if (!Array.isArray(data)) return;
        tleRef.current = data;
        const satrecs = data.map((tle) => satellite.twoline2satrec(tle.line1, tle.line2));
        satrecsRef.current = satrecs;
        countRef.current = satrecs.length;
        positionsRef.current = new Float32Array(satrecs.length * 3);

        if (meshRef.current) {
          meshRef.current.count = satrecs.length;
          const colors = new Float32Array(satrecs.length * 3);
          for (let i = 0; i < satrecs.length; i++) {
            colors[i * 3] = GPS_COLOR.r;
            colors[i * 3 + 1] = GPS_COLOR.g;
            colors[i * 3 + 2] = GPS_COLOR.b;
          }
          meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        }

        console.log(`Loaded ${satrecs.length} GPS satellites`);
      })
      .catch((err) => console.error('GPS TLE fetch failed:', err));
  }, []);

  // Mouse hover
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.current = e.clientX;
      mouseY.current = e.clientY;
      needsRaycast.current = true;
    };
    const onLeave = () => {
      if (lastTooltipIdx.current !== null) {
        dispatchGpsTooltip(null);
        lastTooltipIdx.current = null;
      }
    };
    gl.domElement.addEventListener('mousemove', onMove);
    gl.domElement.addEventListener('mouseleave', onLeave);
    return () => {
      gl.domElement.removeEventListener('mousemove', onMove);
      gl.domElement.removeEventListener('mouseleave', onLeave);
    };
  }, [gl]);

  // Propagate all GPS satellites
  const updatePositions = useCallback(() => {
    const satrecs = satrecsRef.current;
    const mesh = meshRef.current;
    const positions = positionsRef.current;
    const count = countRef.current;
    if (!satrecs.length || !mesh || !positions || count === 0) return;

    const now = new Date();
    const gmst = satellite.gstime(now);

    for (let i = 0; i < count; i++) {
      try {
        const result = satellite.propagate(satrecs[i], now);
        if (!result || !result.position || typeof result.position === 'boolean') {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = 0;
          tempObject.scale.setScalar(0);
          tempObject.updateMatrix();
          mesh.setMatrixAt(i, tempObject.matrix);
          continue;
        }

        const posEci = result.position as satellite.EciVec3<number>;
        const gd = satellite.eciToGeodetic(posEci, gmst);

        const lat = gd.latitude;
        const lon = gd.longitude;
        const alt = gd.height;

        const radius = 1 + alt / 6371;
        const x = radius * Math.cos(lat) * Math.cos(lon);
        const y = radius * Math.sin(lat);
        const z = -radius * Math.cos(lat) * Math.sin(lon);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        tempObject.position.set(x, y, z);
        tempObject.scale.setScalar(1);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);
      } catch {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        tempObject.scale.setScalar(0);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  const frameCount = useRef(0);
  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 60 === 0 || frameCount.current === 1) {
      updatePositions();
    }

    // Screen-space nearest-neighbor picking for GPS sats
    if (needsRaycast.current) {
      needsRaycast.current = false;
      const positions = positionsRef.current;
      const count = countRef.current;
      if (!positions || count === 0) return;

      const rect = gl.domElement.getBoundingClientRect();
      const mx = mouseX.current - rect.left;
      const my = mouseY.current - rect.top;
      const MAX_PICK_PX = 20;

      let bestIdx = -1;
      let bestDistSq = MAX_PICK_PX * MAX_PICK_PX;
      const proj = new THREE.Vector3();

      for (let i = 0; i < count; i++) {
        const pi = i * 3;
        const x = positions[pi], y = positions[pi + 1], z = positions[pi + 2];
        if (x === 0 && y === 0 && z === 0) continue;

        proj.set(x, y, z).project(camera);
        if (proj.z > 1) continue;

        const sx = ((proj.x + 1) / 2) * rect.width;
        const sy = ((-proj.y + 1) / 2) * rect.height;
        const distSq = (sx - mx) ** 2 + (sy - my) ** 2;

        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        if (bestIdx !== lastTooltipIdx.current) {
          lastTooltipIdx.current = bestIdx;
          const tle = tleRef.current?.[bestIdx];
          if (tle) {
            const pi = bestIdx * 3;
            const dist = Math.sqrt(positions[pi] ** 2 + positions[pi + 1] ** 2 + positions[pi + 2] ** 2);
            const altKm = Math.round((dist - 1) * 6371);

            proj.set(positions[pi], positions[pi + 1], positions[pi + 2]).project(camera);
            dispatchGpsTooltip({
              name: tle.name,
              noradId: parseNoradId(tle.line1),
              altitude: `${altKm.toLocaleString()} km (MEO)`,
              x: ((proj.x + 1) / 2) * rect.width + rect.left,
              y: ((-proj.y + 1) / 2) * rect.height + rect.top,
            });
          }
        }
      } else if (lastTooltipIdx.current !== null) {
        dispatchGpsTooltip(null);
        lastTooltipIdx.current = null;
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, 32]}
      frustumCulled={false}
    />
  );
}
