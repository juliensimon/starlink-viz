'use client';

import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard, Text } from '@react-three/drei';
import { CONSTELLATIONS } from '@/data/constellations';
import { raDecToAzEl } from '@/lib/utils/star-coordinates';
import { computeObserverFrame, azElToDirection3D } from '@/lib/utils/observer-frame';
import { useAppStore } from '@/stores/app-store';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

const DOME_RADIUS = 2.0;
const UPDATE_INTERVAL_MS = 10000; // 10s — same as SkyStars
const MIN_ELEVATION = -2; // degrees — only render above horizon

/** Convert RA/Dec to a dome-space 3D position, or null if below horizon. */
function raDec2Dome(
  ra: number, dec: number,
  now: Date, lat: number, lon: number,
  frame: ReturnType<typeof computeObserverFrame>
): THREE.Vector3 | null {
  const { az, el } = raDecToAzEl(ra, dec, now, lat, lon);
  if (el < MIN_ELEVATION) return null;
  const dir = azElToDirection3D(frame, az, el);
  return new THREE.Vector3(
    frame.pos.x + dir.x * DOME_RADIUS,
    frame.pos.y + dir.y * DOME_RADIUS,
    frame.pos.z + dir.z * DOME_RADIUS,
  );
}

export default function SkyConstellations() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const lastUpdateRef = useRef(0);
  const labelsRef = useRef<Array<{ abbr: string; name: string; position: THREE.Vector3 }>>([]);

  const demoLocation = useAppStore((s) => s.demoLocation);
  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;

  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  // Count total line segments across all constellations
  const totalSegments = useMemo(
    () => CONSTELLATIONS.reduce((n, c) => n + c.lines.length, 0),
    [],
  );

  // Pre-allocate geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // 2 vertices per segment, 3 floats per vertex
    const pos = new Float32Array(totalSegments * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, [totalSegments]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({
      color: new THREE.Color('#2a4466'),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      toneMapped: false,
    }),
    [],
  );

  const updatePositions = useCallback(() => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const now = new Date();
    const newLabels: Array<{ abbr: string; name: string; position: THREE.Vector3 }> = [];

    let idx = 0;

    for (const constellation of CONSTELLATIONS) {
      let anyVisible = false;

      for (const [ra1, dec1, ra2, dec2] of constellation.lines) {
        const p1 = raDec2Dome(ra1, dec1, now, lat, lon, frame);
        const p2 = raDec2Dome(ra2, dec2, now, lat, lon, frame);

        if (p1 && p2) {
          pos[idx]     = p1.x;
          pos[idx + 1] = p1.y;
          pos[idx + 2] = p1.z;
          pos[idx + 3] = p2.x;
          pos[idx + 4] = p2.y;
          pos[idx + 5] = p2.z;
          anyVisible = true;
        } else {
          // Hide segment by collapsing to zero-length
          pos[idx] = pos[idx + 1] = pos[idx + 2] = 0;
          pos[idx + 3] = pos[idx + 4] = pos[idx + 5] = 0;
        }
        idx += 6;
      }

      // Label at constellation center if any lines are visible
      if (anyVisible) {
        const labelPos = raDec2Dome(constellation.ra, constellation.dec, now, lat, lon, frame);
        if (labelPos) {
          newLabels.push({
            abbr: constellation.abbr,
            name: constellation.name,
            position: labelPos,
          });
        }
      }
    }

    posAttr.needsUpdate = true;
    labelsRef.current = newLabels;
  }, [geometry, frame, lat, lon]);

  // Initial computation
  useMemo(() => { updatePositions(); }, [updatePositions]);

  useFrame(() => {
    const now = performance.now();
    if (now - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
      lastUpdateRef.current = now;
      updatePositions();
    }
  });

  return (
    <group>
      <lineSegments ref={linesRef} geometry={geometry} material={material} />
      {labelsRef.current.map((l) => (
        <Billboard key={l.abbr} position={[l.position.x, l.position.y, l.position.z]}>
          <Text
            fontSize={0.04}
            color="#6699cc"
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.5}
            outlineWidth={0.002}
            outlineColor="#000000"
            letterSpacing={0.08}
          >
            {l.name.toUpperCase()}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}
