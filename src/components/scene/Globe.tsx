'use client';

import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function Globe() {
  const [dayTexture, nightTexture] = useTexture([
    '/textures/earth_daymap.jpg',
    '/textures/earth_nightmap.jpg',
  ]);

  const emissiveColor = useMemo(() => new THREE.Color(1, 1, 1), []);

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        map={dayTexture}
        emissiveMap={nightTexture}
        emissive={emissiveColor}
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}
