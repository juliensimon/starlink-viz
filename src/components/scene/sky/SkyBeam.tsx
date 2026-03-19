'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '@/stores/app-store';
import { getPositionsArray } from '@/lib/satellites/satellite-store';
import { computeObserverFrame, computeAzElFrom, azElToDirection3D } from '@/lib/utils/observer-frame';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

const DOME_RADIUS = 2.0;
const BEAM_SEGMENTS = 20;

/**
 * Draws a beam from the observer toward the connected satellite in sky view.
 * Cyan beam with additive blending, fading from bright at observer to dim at satellite.
 */
export default function SkyBeam() {
  const demoLocation = useAppStore((s) => s.demoLocation);
  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;
  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  const { line, posAttr, colorAttr } = useMemo(() => {
    const positions = new Float32Array(BEAM_SEGMENTS * 3);
    const colors = new Float32Array(BEAM_SEGMENTS * 3);
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
          gl_FragColor = vec4(vColor, brightness * 0.7);
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
    const connIdx = useAppStore.getState().connectedSatelliteIndex;
    const positions = getPositionsArray();

    if (connIdx === null || !positions) {
      if (line.visible) line.visible = false;
      return;
    }

    const pi = connIdx * 3;
    const x = positions[pi], y = positions[pi + 1], z = positions[pi + 2];
    if (x === 0 && y === 0 && z === 0) {
      line.visible = false;
      return;
    }

    const { az, el } = computeAzElFrom(frame, x, y, z);
    if (el < 0) {
      line.visible = false;
      return;
    }

    const pos = posAttr.array as Float32Array;
    const col = colorAttr.array as Float32Array;

    // Draw beam from observer to satellite dome position
    const dir = azElToDirection3D(frame, az, el);
    for (let i = 0; i < BEAM_SEGMENTS; i++) {
      const t = i / (BEAM_SEGMENTS - 1);
      const r = t * DOME_RADIUS;

      pos[i * 3]     = frame.pos.x + dir.x * r;
      pos[i * 3 + 1] = frame.pos.y + dir.y * r;
      pos[i * 3 + 2] = frame.pos.z + dir.z * r;

      // Gradient: bright cyan at base, fading out toward satellite
      const intensity = (1 - t * 0.7) * 0.6;
      col[i * 3]     = 0.0 * intensity;
      col[i * 3 + 1] = 1.0 * intensity;
      col[i * 3 + 2] = 1.0 * intensity;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    line.visible = true;
  });

  return <primitive object={line} />;
}
