'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DISH_POS } from '@/lib/utils/dish-frame';

export function getDishPosition(): THREE.Vector3 {
  return new THREE.Vector3(DISH_POS.x, DISH_POS.y, DISH_POS.z);
}

export default function DishMarker() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);

  const position = useMemo(() => getDishPosition(), []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#00ffff'),
        transparent: true,
        opacity: 1.0,
      }),
    []
  );

  const glowMaterial = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(0.4, 'rgba(0, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = 1 + 0.3 * Math.sin(clock.elapsedTime * 3);
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      const scale = 0.03 + 0.008 * Math.sin(clock.elapsedTime * 2);
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} material={material}>
        <sphereGeometry args={[0.006, 8, 8]} />
      </mesh>
      <sprite ref={glowRef} material={glowMaterial} />
    </group>
  );
}
