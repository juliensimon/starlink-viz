'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '@/stores/app-store';
import { getPositionsArray } from '@/lib/satellites/satellite-store';
import { computeObserverFrame, computeAzElFrom, azElToDirection3D } from '@/lib/utils/observer-frame';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

const DOME_RADIUS = 2.0;

/** Create a soft radial gradient texture for the glow sprite */
function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0, 255, 255, 1.0)');
  gradient.addColorStop(0.15, 'rgba(0, 255, 255, 0.6)');
  gradient.addColorStop(0.4, 'rgba(0, 200, 255, 0.15)');
  gradient.addColorStop(1, 'rgba(0, 100, 200, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** Create a ring texture for the halo */
function makeHaloTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  // Outer glow ring
  const gradient = ctx.createRadialGradient(cx, cy, size * 0.25, cx, cy, size * 0.5);
  gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
  gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.4)');
  gradient.addColorStop(0.7, 'rgba(0, 220, 255, 0.6)');
  gradient.addColorStop(0.85, 'rgba(0, 200, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 150, 200, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

const BEAM_SPRITES = 8; // sprites along the beam

/**
 * Glowing beam from observer toward connected satellite.
 * Uses billboard sprites for a soft volumetric look, plus a halo ring at the satellite.
 */
export default function SkyBeam() {
  const groupRef = useRef<THREE.Group>(null);
  const demoLocation = useAppStore((s) => s.demoLocation);
  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;
  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  // Beam sprites — soft glow dots along the beam direction
  const glowMat = useMemo(() => {
    const tex = makeGlowTexture();
    return new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.5,
    });
  }, []);

  // Halo sprite at the satellite
  const haloMat = useMemo(() => {
    const tex = makeHaloTexture();
    return new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.7,
    });
  }, []);

  const sprites = useMemo(() => {
    const arr: THREE.Sprite[] = [];
    for (let i = 0; i < BEAM_SPRITES; i++) {
      const s = new THREE.Sprite(glowMat);
      s.visible = false;
      arr.push(s);
    }
    return arr;
  }, [glowMat]);

  const halo = useMemo(() => {
    const s = new THREE.Sprite(haloMat);
    s.visible = false;
    return s;
  }, [haloMat]);

  useFrame(({ clock }) => {
    const connIdx = useAppStore.getState().connectedSatelliteIndex;
    const positions = getPositionsArray();

    if (connIdx === null || !positions) {
      sprites.forEach(s => s.visible = false);
      halo.visible = false;
      return;
    }

    const pi = connIdx * 3;
    const x = positions[pi], y = positions[pi + 1], z = positions[pi + 2];
    if (x === 0 && y === 0 && z === 0) {
      sprites.forEach(s => s.visible = false);
      halo.visible = false;
      return;
    }

    const { az, el } = computeAzElFrom(frame, x, y, z);
    if (el < 0) {
      sprites.forEach(s => s.visible = false);
      halo.visible = false;
      return;
    }

    const dir = azElToDirection3D(frame, az, el);
    const time = clock.elapsedTime;

    // Place glow sprites along beam
    for (let i = 0; i < BEAM_SPRITES; i++) {
      const t = (i + 1) / (BEAM_SPRITES + 1); // 0 excluded (observer), 1 excluded (sat)
      const r = t * DOME_RADIUS;
      const sprite = sprites[i];

      sprite.position.set(
        frame.pos.x + dir.x * r,
        frame.pos.y + dir.y * r,
        frame.pos.z + dir.z * r
      );

      // Size: larger near satellite, subtle pulse
      const baseSize = 0.03 + t * 0.04;
      const pulse = 1 + 0.15 * Math.sin(time * 2 + t * 5);
      const fade = 0.3 + 0.7 * (1 - Math.abs(t - 0.5) * 2); // brightest in middle
      sprite.scale.setScalar(baseSize * pulse);
      sprite.material.opacity = fade * 0.35;
      sprite.visible = true;
    }

    // Halo at satellite position
    const satPos = {
      x: frame.pos.x + dir.x * DOME_RADIUS,
      y: frame.pos.y + dir.y * DOME_RADIUS,
      z: frame.pos.z + dir.z * DOME_RADIUS,
    };
    halo.position.set(satPos.x, satPos.y, satPos.z);
    const haloScale = 0.12 + 0.02 * Math.sin(time * 3);
    halo.scale.setScalar(haloScale);
    halo.visible = true;

  });

  return (
    <group ref={groupRef}>
      {sprites.map((s, i) => <primitive key={i} object={s} />)}
      <primitive object={halo} />
    </group>
  );
}
