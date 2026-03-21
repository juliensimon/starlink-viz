'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { geodeticToCartesian } from '@/lib/utils/coordinates';
import { GROUND_STATIONS, groundStationsVersion, refreshGroundStations } from '@/lib/satellites/ground-stations';

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Lazily computed — rebuilt when groundStationsVersion changes
let stationPositions: THREE.Vector3[] = [];
let gsPositionsVersion = -1;

function ensureStationPositions(): THREE.Vector3[] {
  if (gsPositionsVersion !== groundStationsVersion) {
    stationPositions = GROUND_STATIONS.map((gs) => {
      const { x, y, z } = geodeticToCartesian(degToRad(gs.lat), degToRad(gs.lon), 0, 1);
      return new THREE.Vector3(x, y, z);
    });
    gsPositionsVersion = groundStationsVersion;
  }
  return stationPositions;
}

export function getGroundStationPosition(index: number): THREE.Vector3 {
  return ensureStationPositions()[index];
}

function dispatchGSTooltip(data: { name: string; lat: number; lon: number; status?: string; x: number; y: number } | null) {
  window.dispatchEvent(new CustomEvent('gs-tooltip', { detail: data }));
}

// 4-pointed star shape for ground station markers
function createStarGeometry(outerRadius: number, innerRadius: number, points: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export default function GroundStations() {
  const { camera, gl } = useThree();
  const [gsVersion, setGsVersion] = useState(groundStationsVersion);
  const geometry = useMemo(() => createStarGeometry(0.007, 0.003, 4), []);

  // Load ground stations from API on mount (client-side)
  useEffect(() => {
    if (GROUND_STATIONS.length === 0) {
      refreshGroundStations().then(() => setGsVersion(groundStationsVersion));
    }
  }, []);
  const operationalMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9933'), side: THREE.DoubleSide }),
    []
  );
  const plannedMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9933'), side: THREE.DoubleSide, transparent: true, opacity: 0.35 }),
    []
  );

  const meshesRef = useRef<THREE.Mesh[]>([]);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const needsRaycast = useRef(false);
  const lastHitRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    needsRaycast.current = true;
  }, [gl]);

  const handleMouseLeave = useCallback(() => {
    dispatchGSTooltip(null);
    lastHitRef.current = null;
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
    // Billboard: orient flat star shapes toward the camera
    const meshes = meshesRef.current;
    for (let i = 0; i < meshes.length; i++) {
      if (meshes[i]) meshes[i].quaternion.copy(camera.quaternion);
    }

    if (!needsRaycast.current) return;
    needsRaycast.current = false;

    raycaster.current.setFromCamera(mouse.current, camera);
    const hitTargets = meshesRef.current.filter(Boolean);
    const intersections = raycaster.current.intersectObjects(hitTargets);

    if (intersections.length > 0) {
      const idx = hitTargets.indexOf(intersections[0].object as THREE.Mesh);
      if (idx >= 0 && idx !== lastHitRef.current) {
        lastHitRef.current = idx;
        const gs = GROUND_STATIONS[idx];
        const positions = ensureStationPositions();
        const pos3d = positions[idx].clone().project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        dispatchGSTooltip({
          name: gs.name,
          lat: gs.lat,
          lon: gs.lon,
          status: gs.status,
          x: ((pos3d.x + 1) / 2) * rect.width + rect.left,
          y: ((-pos3d.y + 1) / 2) * rect.height + rect.top,
        });
      }
    } else if (lastHitRef.current !== null) {
      dispatchGSTooltip(null);
      lastHitRef.current = null;
    }
  });

  return (
    <group>
      {ensureStationPositions().map((pos, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshesRef.current[i] = el; }}
          position={pos}
          geometry={geometry}
          material={GROUND_STATIONS[i].status === 'planned' ? plannedMaterial : operationalMaterial}
        />
      ))}
    </group>
  );
}
