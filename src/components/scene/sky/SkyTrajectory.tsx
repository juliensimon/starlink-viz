'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '@/stores/app-store';
import { getSatrecs } from '@/lib/satellites/satellite-store';
import { propagatePosition } from '@/lib/satellites/propagator';
import { computeObserverFrame, computeAzElFrom, azElToDirection3D } from '@/lib/utils/observer-frame';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

const DOME_RADIUS = 2.0;
const TRAIL_MINUTES_PAST = 5;
const TRAIL_MINUTES_FUTURE = 5;
const TRAIL_STEPS = 80;
const UPDATE_MS = 500;

/**
 * Draws a satellite trajectory arc on the sky dome when hovered.
 * Past = cyan gradient, future = warm yellow gradient, both fading at ends.
 * Dispatched via 'sky-trajectory' custom event with { satIdx }.
 */
export default function SkyTrajectory() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const lastUpdate = useRef(0);

  const demoLocation = useAppStore((s) => s.demoLocation);
  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;
  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHoveredIdx(detail?.satIdx ?? null);
    };
    window.addEventListener('sky-trajectory', handler);
    return () => window.removeEventListener('sky-trajectory', handler);
  }, []);

  const { line, posAttr, colorAttr } = useMemo(() => {
    const positions = new Float32Array(TRAIL_STEPS * 3);
    const colors = new Float32Array(TRAIL_STEPS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float brightness = max(vColor.r, max(vColor.g, vColor.b));
          gl_FragColor = vec4(vColor, brightness);
        }
      `,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });

    const l = new THREE.Line(geo, mat);
    l.frustumCulled = false;
    l.visible = false;

    return {
      line: l,
      posAttr: geo.getAttribute('position') as THREE.BufferAttribute,
      colorAttr: geo.getAttribute('color') as THREE.BufferAttribute,
    };
  }, []);

  useFrame(() => {
    if (hoveredIdx === null) {
      if (line.visible) line.visible = false;
      return;
    }

    const now = performance.now();
    if (now - lastUpdate.current < UPDATE_MS) return;
    lastUpdate.current = now;

    const satrecs = getSatrecs();
    if (!satrecs[hoveredIdx]) {
      line.visible = false;
      return;
    }

    const satrec = satrecs[hoveredIdx];
    const currentTime = new Date();
    const totalMinutes = TRAIL_MINUTES_PAST + TRAIL_MINUTES_FUTURE;
    const pos = posAttr.array as Float32Array;
    const col = colorAttr.array as Float32Array;
    const pastFrac = TRAIL_MINUTES_PAST / totalMinutes;

    let validPoints = 0;

    for (let i = 0; i < TRAIL_STEPS; i++) {
      const t = i / (TRAIL_STEPS - 1);
      const minuteOffset = -TRAIL_MINUTES_PAST + t * totalMinutes;
      const date = new Date(currentTime.getTime() + minuteOffset * 60000);

      const p = propagatePosition(satrec, date);
      if (!p) {
        pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
        col[i * 3] = 0; col[i * 3 + 1] = 0; col[i * 3 + 2] = 0;
        continue;
      }

      const { az, el } = computeAzElFrom(frame, p.x, p.y, p.z);

      if (el < -2) {
        const dir = azElToDirection3D(frame, az, 0);
        pos[i * 3]     = frame.pos.x + dir.x * DOME_RADIUS;
        pos[i * 3 + 1] = frame.pos.y + dir.y * DOME_RADIUS;
        pos[i * 3 + 2] = frame.pos.z + dir.z * DOME_RADIUS;
        col[i * 3] = 0; col[i * 3 + 1] = 0; col[i * 3 + 2] = 0;
        continue;
      }

      const dir = azElToDirection3D(frame, az, el);
      pos[i * 3]     = frame.pos.x + dir.x * DOME_RADIUS;
      pos[i * 3 + 1] = frame.pos.y + dir.y * DOME_RADIUS;
      pos[i * 3 + 2] = frame.pos.z + dir.z * DOME_RADIUS;

      // Gradient: bright at "now", fading toward ends
      const distFromNow = Math.abs(t - pastFrac) / Math.max(pastFrac, 1 - pastFrac);
      const intensity = Math.pow(Math.max(0, 1 - distFromNow), 1.5);

      if (t < pastFrac) {
        // Past — cyan
        col[i * 3]     = 0.15 * intensity;
        col[i * 3 + 1] = 0.85 * intensity;
        col[i * 3 + 2] = 1.0 * intensity;
      } else {
        // Future — warm yellow-white
        col[i * 3]     = 1.0 * intensity;
        col[i * 3 + 1] = 0.9 * intensity;
        col[i * 3 + 2] = 0.4 * intensity;
      }
      validPoints++;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    line.visible = validPoints > 2;
  });

  return <primitive object={line} />;
}
