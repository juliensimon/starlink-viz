'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

export default function SceneSetup() {
  const { camera, gl } = useThree();
  // Check if postprocessing is safe (WebGL context might be limited in headless browsers)
  const [postProcessingOk, setPostProcessingOk] = useState(false);
  useEffect(() => {
    try {
      const ctx = gl.getContext();
      if (ctx && ctx.getParameter(ctx.VERSION)) {
        setPostProcessingOk(true);
      }
    } catch {
      // Postprocessing not available
    }
  }, [gl]);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const targetLookAt = useRef<THREE.Vector3 | null>(null);
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const animProgress = useRef(1); // 1 = done

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(mouse.current, camera);

      // Create a globe sphere for intersection testing
      const globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
      const hitPoint = new THREE.Vector3();
      const ray = raycaster.current.ray;

      if (ray.intersectSphere(globeSphere, hitPoint)) {
        targetLookAt.current = hitPoint.clone();
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
    if (targetLookAt.current && animProgress.current < 1) {
      animProgress.current = Math.min(1, animProgress.current + delta * 2); // ~500ms
      currentLookAt.current.lerp(targetLookAt.current, animProgress.current);

      // Smoothly move camera to look at the target point
      const dir = currentLookAt.current.clone().normalize();
      const dist = camera.position.length();
      camera.position.copy(dir.multiplyScalar(dist));
      camera.lookAt(0, 0, 0);

      if (animProgress.current >= 1) {
        targetLookAt.current = null;
      }
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={1.8} />

      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={1.5}
        maxDistance={5}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
      />

      {/* Star field background */}
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      {/* Post-processing (skipped if WebGL context is limited) */}
      {postProcessingOk && (
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.8}
            intensity={0.5}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </>
  );
}
