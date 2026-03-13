'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function Globe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const [dayTexture, nightTexture] = useTexture([
    '/textures/earth_daymap.jpg',
    '/textures/earth_nightmap.jpg',
  ]);

  const emissiveColor = useMemo(() => new THREE.Color(1, 1, 1), []);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <mesh ref={meshRef}>
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
