'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/stores/app-store';
import { getDishPosition } from './DishMarker';

const FOCUS_DISTANCE = 1.5; // Max zoom (matches OrbitControls minDistance)

export default function SceneSetup() {
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const targetLookAt = useRef<THREE.Vector3 | null>(null);
  const targetCamPos = useRef<THREE.Vector3 | null>(null);
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const animProgress = useRef(1); // 1 = done

  const autoRotate = useAppStore((s) => s.autoRotate);
  const focusDishRequested = useAppStore((s) => s.focusDishRequested);

  // Focus on dish when requested
  useEffect(() => {
    if (focusDishRequested === 0) return;
    const dishPos = getDishPosition();
    const dir = dishPos.clone().normalize();
    targetCamPos.current = dir.clone().multiplyScalar(FOCUS_DISTANCE);
    targetLookAt.current = new THREE.Vector3(0, 0, 0);
    animProgress.current = 0;
  }, [focusDishRequested]);

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(mouse.current, camera);

      const globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
      const hitPoint = new THREE.Vector3();
      const ray = raycaster.current.ray;

      if (ray.intersectSphere(globeSphere, hitPoint)) {
        const dir = hitPoint.clone().normalize();
        targetCamPos.current = dir.multiplyScalar(camera.position.length());
        targetLookAt.current = new THREE.Vector3(0, 0, 0);
        animProgress.current = 0;
      }
    },
    [camera, gl]
  );

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('dblclick', handleDoubleClick);
    return () => {
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [gl, handleDoubleClick]);

  useFrame((_state, delta) => {
    if (targetCamPos.current && animProgress.current < 1) {
      animProgress.current = Math.min(1, animProgress.current + delta * 2);
      const t = animProgress.current;
      // Smooth ease-out
      const ease = 1 - Math.pow(1 - t, 3);

      camera.position.lerp(targetCamPos.current, ease);
      camera.lookAt(0, 0, 0);

      if (animProgress.current >= 1) {
        targetCamPos.current = null;
        targetLookAt.current = null;
      }
    }
  });

  return (
    <>
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={1.5}
        maxDistance={5}
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={0.3}
      />

      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />
    </>
  );
}
