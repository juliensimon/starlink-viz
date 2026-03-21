'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Billboard, Text } from '@react-three/drei';
import { useAppStore } from '@/stores/app-store';
import { computeObserverFrame, azElToDirection3D } from '@/lib/utils/observer-frame';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

const DOME_RADIUS = 2.0;
const SEGMENTS = 64;
const LINE_COLOR = '#1e3a5a';
const LINE_OPACITY = 0.35;
const LABEL_COLOR = '#88ccee';

const CARDINALS: Array<{ label: string; az: number; size: number }> = [
  { label: 'N', az: 0, size: 0.16 },
  { label: 'NE', az: 45, size: 0.07 },
  { label: 'E', az: 90, size: 0.14 },
  { label: 'SE', az: 135, size: 0.07 },
  { label: 'S', az: 180, size: 0.14 },
  { label: 'SW', az: 225, size: 0.07 },
  { label: 'W', az: 270, size: 0.14 },
  { label: 'NW', az: 315, size: 0.07 },
];

function makeRingPoints(
  frame: ReturnType<typeof computeObserverFrame>,
  elDeg: number,
  segments: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const az = (i / segments) * 360;
    const dir = azElToDirection3D(frame, az, elDeg);
    points.push(new THREE.Vector3(
      frame.pos.x + dir.x * DOME_RADIUS,
      frame.pos.y + dir.y * DOME_RADIUS,
      frame.pos.z + dir.z * DOME_RADIUS
    ));
  }
  return points;
}

function makeAzLinePoints(
  frame: ReturnType<typeof computeObserverFrame>,
  azDeg: number,
  segments: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const el = (i / segments) * 90;
    const dir = azElToDirection3D(frame, azDeg, el);
    points.push(new THREE.Vector3(
      frame.pos.x + dir.x * DOME_RADIUS,
      frame.pos.y + dir.y * DOME_RADIUS,
      frame.pos.z + dir.z * DOME_RADIUS
    ));
  }
  return points;
}

function makeLine(points: THREE.Vector3[], material: THREE.LineBasicMaterial): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, material);
}

export default function SkyGrid() {
  const demoLocation = useAppStore((s) => s.demoLocation);
  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;

  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  const lineMaterial = useMemo(
    () => new THREE.LineBasicMaterial({
      color: LINE_COLOR,
      transparent: true,
      opacity: LINE_OPACITY,
      depthWrite: false,
    }),
    []
  );

  const lines = useMemo(() => {
    const result: THREE.Line[] = [];

    // 30° and 60° elevation circles
    result.push(makeLine(makeRingPoints(frame, 30, SEGMENTS), lineMaterial));
    result.push(makeLine(makeRingPoints(frame, 60, SEGMENTS), lineMaterial));

    // 8 azimuth lines (every 45°)
    for (const az of [0, 45, 90, 135, 180, 225, 270, 315]) {
      result.push(makeLine(makeAzLinePoints(frame, az, 16), lineMaterial));
    }

    return result;
  }, [frame, lineMaterial]);

  // Cardinal label positions — at 8° elevation so they sit just above horizon
  const labels = useMemo(
    () => CARDINALS.map((c) => {
      const dir = azElToDirection3D(frame, c.az, 8);
      return {
        ...c,
        position: new THREE.Vector3(
          frame.pos.x + dir.x * DOME_RADIUS,
          frame.pos.y + dir.y * DOME_RADIUS,
          frame.pos.z + dir.z * DOME_RADIUS
        ),
      };
    }),
    [frame]
  );

  return (
    <group>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
      {labels.map((l) => (
        <Billboard key={l.label} position={l.position} follow lockX={false} lockY={false} lockZ={false}>
          <Text
            fontSize={l.size}
            color={LABEL_COLOR}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.003}
            outlineColor="#000000"
          >
            {l.label}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}
