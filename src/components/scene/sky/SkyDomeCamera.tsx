'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/stores/app-store';
import { computeObserverFrame } from '@/lib/utils/observer-frame';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

/**
 * Stellarium-style horizon camera.
 *
 * OrbitControls polar angle with up = zenith:
 *   0   = looking DOWN at ground (nadir)
 *   π/2 = looking HORIZONTALLY (horizon)
 *   π   = looking UP at zenith
 *
 * We allow π*0.44 (10° below horizon) to π*0.99 (nearly zenith).
 * Default view: 35° above horizon → polar = π/2 + 35°*(π/180) ≈ 0.694π
 */
export default function SkyDomeCamera() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const demoLocation = useAppStore((s) => s.demoLocation);

  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;

  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 90;
    cam.near = 0.0001;
    cam.far = 10;
    cam.updateProjectionMatrix();

    // Camera "up" = observer's zenith
    cam.up.set(frame.normal.x, frame.normal.y, frame.normal.z);

    // Initial look: 35° above north horizon
    // Camera must be offset OPPOSITE to look direction from target
    const lookElRad = 35 * Math.PI / 180;
    const cosEl = Math.cos(lookElRad);
    const sinEl = Math.sin(lookElRad);
    const lookX = frame.north.x * cosEl + frame.normal.x * sinEl;
    const lookY = frame.north.y * cosEl + frame.normal.y * sinEl;
    const lookZ = frame.north.z * cosEl + frame.normal.z * sinEl;

    const offset = 0.0005;
    cam.position.set(
      frame.pos.x - lookX * offset,
      frame.pos.y - lookY * offset,
      frame.pos.z - lookZ * offset
    );

    if (controlsRef.current) {
      controlsRef.current.target.set(frame.pos.x, frame.pos.y, frame.pos.z);
      controlsRef.current.update();
    }
  }, [camera, frame]);

  const target = useMemo(
    () => new THREE.Vector3(frame.pos.x, frame.pos.y, frame.pos.z),
    [frame]
  );

  return (
    <OrbitControls
      ref={controlsRef}
      target={target}
      enablePan={false}
      enableZoom={true}
      minDistance={0.0003}
      maxDistance={0.001}
      // π*0.44 = 10° below horizon, π*0.99 = nearly zenith
      minPolarAngle={Math.PI * 0.44}
      maxPolarAngle={Math.PI * 0.99}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
      enableDamping
      dampingFactor={0.15}
      rotateSpeed={0.5}
    />
  );
}
