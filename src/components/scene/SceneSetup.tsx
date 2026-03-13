'use client';

import { Stars, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

export default function SceneSetup() {
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

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.8}
          intensity={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}
