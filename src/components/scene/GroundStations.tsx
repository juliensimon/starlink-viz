'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { geodeticToCartesian } from '@/lib/utils/coordinates';
import { GROUND_STATIONS } from '@/lib/satellites/ground-stations';

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const stationPositions = GROUND_STATIONS.map((gs) => {
  const { x, y, z } = geodeticToCartesian(degToRad(gs.lat), degToRad(gs.lon), 0, 1);
  return new THREE.Vector3(x, y, z);
});

export function getGroundStationPosition(index: number): THREE.Vector3 {
  return stationPositions[index];
}

export default function GroundStations() {
  const geometry = useMemo(() => new THREE.SphereGeometry(0.003, 6, 6), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#1a5566'),
        transparent: true,
        opacity: 0.6,
      }),
    []
  );

  return (
    <group>
      {stationPositions.map((pos, i) => (
        <mesh key={i} position={pos} geometry={geometry} material={material} />
      ))}
    </group>
  );
}
