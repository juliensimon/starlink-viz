'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { getSunDirection } from '@/lib/utils/astronomy';

const SUN_DISTANCE = 50;
const UPDATE_INTERVAL = 2; // seconds
const SUN_VISUAL_SIZE = 0.5;
const SUN_GLOW_SIZE = 3;

/** Generate a smooth radial gradient texture on a canvas */
function createGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 245, 230, 1)');
  gradient.addColorStop(0.15, 'rgba(255, 235, 200, 0.8)');
  gradient.addColorStop(0.4, 'rgba(255, 220, 150, 0.3)');
  gradient.addColorStop(0.7, 'rgba(255, 200, 100, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 180, 80, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function Sun() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const coreSpriteRef = useRef<THREE.Sprite>(null);
  const glowSpriteRef = useRef<THREE.Sprite>(null);
  const elapsedRef = useRef(0);
  const sunDirRef = useRef(getSunDirection(new Date()));
  const { scene } = useThree();

  const glowTexture = useMemo(() => createGlowTexture(), []);

  // Lens flare on the directional light (camera artifact effect)
  const flareTexture0 = useLoader(THREE.TextureLoader, '/textures/lensflare0.png');
  const flareTexture3 = useLoader(THREE.TextureLoader, '/textures/lensflare3.png');

  useEffect(() => {
    const light = lightRef.current;
    if (!light || !flareTexture0 || !flareTexture3) return;

    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(flareTexture0, 200, 0, new THREE.Color(1.0, 0.95, 0.85)));
    lensflare.addElement(new LensflareElement(flareTexture3, 60, 0.6, new THREE.Color(0.8, 0.8, 1.0)));
    lensflare.addElement(new LensflareElement(flareTexture3, 70, 0.7, new THREE.Color(0.8, 0.9, 1.0)));
    lensflare.addElement(new LensflareElement(flareTexture3, 120, 0.9, new THREE.Color(1.0, 0.9, 0.8)));
    lensflare.addElement(new LensflareElement(flareTexture3, 70, 1.0, new THREE.Color(0.7, 0.8, 1.0)));
    light.add(lensflare);

    return () => {
      light.remove(lensflare);
      lensflare.dispose();
    };
  }, [scene, flareTexture0, flareTexture3]);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    if (elapsedRef.current >= UPDATE_INTERVAL) {
      elapsedRef.current = 0;
      sunDirRef.current = getSunDirection(new Date());
    }

    const sunPos = sunDirRef.current.clone().multiplyScalar(SUN_DISTANCE);

    if (lightRef.current) lightRef.current.position.copy(sunPos);
    if (coreSpriteRef.current) coreSpriteRef.current.position.copy(sunPos);
    if (glowSpriteRef.current) glowSpriteRef.current.position.copy(sunPos);
  });

  const initialPos = sunDirRef.current.clone().multiplyScalar(SUN_DISTANCE);
  const posArray = initialPos.toArray() as [number, number, number];

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={posArray}
        intensity={1.8}
        color={new THREE.Color(1.0, 0.98, 0.95)}
      />

      <ambientLight intensity={0.15} />

      {/* Bright sun core */}
      <sprite
        ref={coreSpriteRef}
        position={posArray}
        scale={[SUN_VISUAL_SIZE, SUN_VISUAL_SIZE, 1]}
      >
        <spriteMaterial
          map={glowTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/* Soft radial glow */}
      <sprite
        ref={glowSpriteRef}
        position={posArray}
        scale={[SUN_GLOW_SIZE, SUN_GLOW_SIZE, 1]}
      >
        <spriteMaterial
          map={glowTexture}
          color={new THREE.Color(1.0, 0.9, 0.7)}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </>
  );
}
