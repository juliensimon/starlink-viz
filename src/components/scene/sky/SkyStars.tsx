'use client';

import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard, Text } from '@react-three/drei';
import { BRIGHT_STARS } from '@/data/bright-stars';
import { raDecToAzEl } from '@/lib/utils/star-coordinates';
import { computeObserverFrame, azElToDirection3D } from '@/lib/utils/observer-frame';
import { useAppStore } from '@/stores/app-store';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

const DOME_RADIUS = 2.0;
const STAR_UPDATE_INTERVAL_MS = 10000; // 10s — sidereal rotation is slow
const NAMED_MAG_LIMIT = 2.5; // only label stars brighter than this

/** Map B-V color index to an approximate RGB color */
function bvToColor(bv: number): THREE.Color {
  // Simplified B-V to RGB mapping
  if (bv < -0.1) return new THREE.Color(0.6, 0.7, 1.0);   // blue-white
  if (bv < 0.15) return new THREE.Color(0.8, 0.85, 1.0);   // white
  if (bv < 0.4)  return new THREE.Color(1.0, 0.95, 0.85);  // yellow-white
  if (bv < 0.7)  return new THREE.Color(1.0, 0.9, 0.6);    // yellow
  if (bv < 1.0)  return new THREE.Color(1.0, 0.75, 0.4);   // orange
  return new THREE.Color(1.0, 0.5, 0.3);                    // red-orange
}

export default function SkyStars() {
  const pointsRef = useRef<THREE.Points>(null);
  const lastUpdateRef = useRef(0);
  const labelsRef = useRef<Array<{ name: string; position: THREE.Vector3 }>>([]);

  const demoLocation = useAppStore((s) => s.demoLocation);
  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;

  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  const starCount = BRIGHT_STARS.length;

  // Pre-compute colors and sizes (static — don't change with time)
  const { colors, sizes } = useMemo(() => {
    const c = new Float32Array(starCount * 3);
    const s = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const star = BRIGHT_STARS[i];
      const col = bvToColor(star.bv);
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
      s[i] = Math.max(1, 4 - star.mag) * 0.02;
    }
    return { colors: c, sizes: s };
  }, [starCount]);

  // Geometry with positions buffer (updated periodically)
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(starCount * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [starCount, colors, sizes]);

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.2, d);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    []
  );

  // Update star positions (called from useFrame at 10s intervals)
  const updatePositions = useCallback(() => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const now = new Date();
    const newLabels: Array<{ name: string; position: THREE.Vector3 }> = [];

    for (let i = 0; i < starCount; i++) {
      const star = BRIGHT_STARS[i];
      const { az, el } = raDecToAzEl(star.ra, star.dec, now, lat, lon);

      if (el < -2) {
        // Below horizon — hide by placing at origin (invisible)
        pos[i * 3] = 0;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = 0;
        continue;
      }

      const dir = azElToDirection3D(frame, az, el);
      pos[i * 3]     = frame.pos.x + dir.x * DOME_RADIUS;
      pos[i * 3 + 1] = frame.pos.y + dir.y * DOME_RADIUS;
      pos[i * 3 + 2] = frame.pos.z + dir.z * DOME_RADIUS;

      // Collect named stars for labels
      if (star.name && star.mag < NAMED_MAG_LIMIT) {
        newLabels.push({
          name: star.name,
          position: new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]),
        });
      }
    }

    posAttr.needsUpdate = true;
    labelsRef.current = newLabels;
  }, [geometry, frame, lat, lon, starCount]);

  // Initial position computation
  useMemo(() => { updatePositions(); }, [updatePositions]);

  useFrame(() => {
    const now = performance.now();
    if (now - lastUpdateRef.current >= STAR_UPDATE_INTERVAL_MS) {
      lastUpdateRef.current = now;
      updatePositions();
    }
  });

  return (
    <group>
      <points ref={pointsRef} geometry={geometry} material={material} />
      {labelsRef.current.map((l) => (
        <Billboard key={l.name} position={[l.position.x, l.position.y, l.position.z]}>
          <Text
            fontSize={0.025}
            color="#ffffff"
            anchorX="left"
            anchorY="bottom"
            fillOpacity={0.45}
            outlineWidth={0.001}
            outlineColor="#000000"
          >
            {' ' + l.name}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}
