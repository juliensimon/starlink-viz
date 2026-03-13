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
  isConnected: boolean;
  x: number;
  y: number;
}

function parseNoradId(line1: string): string {
  return line1.substring(2, 7).trim();
}

function estimateAltitude(x: number, y: number, z: number): string {
  const dist = Math.sqrt(x * x + y * y + z * z);
  const altKm = Math.round((dist - 1) * 6371);
  return `~${altKm} km`;
}

/** Dispatches tooltip data as a CustomEvent on window. */
function dispatchTooltip(data: TooltipData | null) {
  window.dispatchEvent(new CustomEvent('satellite-tooltip', { detail: data }));
}

/**
 * Raycasts against the satellite InstancedMesh on mouse move (throttled).
 * Must be placed inside <Canvas>.
 */
export default function SatelliteTooltip() {
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const lastMoveTime = useRef(0);
  const needsRaycast = useRef(false);
  const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const lastTooltipIdx = useRef<number | null>(null);

  // Find the InstancedMesh in the scene (once)
  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh) {
        instancedMeshRef.current = obj as THREE.InstancedMesh;
      }
    });
  }, [scene]);

  // Re-find mesh when scene children change
  useFrame(() => {
    if (!instancedMeshRef.current) {
      scene.traverse((obj) => {
        if ((obj as THREE.InstancedMesh).isInstancedMesh) {
          instancedMeshRef.current = obj as THREE.InstancedMesh;
        }
      });
    }
  });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const now = performance.now();
    if (now - lastMoveTime.current < 100) return;
    lastMoveTime.current = now;

    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    needsRaycast.current = true;
  }, [gl]);

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
    if (!needsRaycast.current || !instancedMeshRef.current) return;
    needsRaycast.current = false;

    const connectedSatelliteIndex = useAppStore.getState().connectedSatelliteIndex;

    raycaster.current.setFromCamera(mouse.current, camera);
    const intersections = raycaster.current.intersectObject(instancedMeshRef.current);

    if (intersections.length > 0 && intersections[0].instanceId !== undefined) {
      const idx = intersections[0].instanceId;

      // Skip redundant updates
      if (idx === lastTooltipIdx.current) return;
      lastTooltipIdx.current = idx;

      const tleData = getTLEData();
      const positions = getPositionsArray();

      if (tleData[idx] && positions) {
        const tle = tleData[idx];
        const pi = idx * 3;

        const pos3d = new THREE.Vector3(positions[pi], positions[pi + 1], positions[pi + 2]);
        pos3d.project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        const screenX = ((pos3d.x + 1) / 2) * rect.width + rect.left;
        const screenY = ((-pos3d.y + 1) / 2) * rect.height + rect.top;

        dispatchTooltip({
          name: tle.name,
          noradId: parseNoradId(tle.line1),
          altitude: estimateAltitude(positions[pi], positions[pi + 1], positions[pi + 2]),
          isConnected: idx === connectedSatelliteIndex,
          x: screenX,
          y: screenY,
        });
      }
    } else {
      if (lastTooltipIdx.current !== null) {
        dispatchTooltip(null);
        lastTooltipIdx.current = null;
      }
    }
  });

  return null;
}
