'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '@/stores/app-store';
import { computeObserverFrame, computeAzElFrom, azElToDirection3D } from '@/lib/utils/observer-frame';
import { getSunDirection } from '@/lib/utils/astronomy';
import { DISH_LAT_DEG, DISH_LON_DEG } from '@/lib/config';

const DOME_RADIUS = 2.0;
const GROUND_RADIUS = 3.0;
const SKY_UPDATE_MS = 2000; // update sky colors every 2s

/**
 * Visual environment for sky view:
 * - Dark ground disc below horizon
 * - Sun-aware sky gradient hemisphere
 * - Bold horizon ring with compass tick marks
 */
export default function SkyEnvironment() {
  const demoLocation = useAppStore((s) => s.demoLocation);
  const lat = demoLocation?.lat ?? DISH_LAT_DEG;
  const lon = demoLocation?.lon ?? DISH_LON_DEG;
  const frame = useMemo(() => computeObserverFrame(lat, lon), [lat, lon]);
  const lastSkyUpdate = useRef(0);

  // Ground disc
  const groundMesh = useMemo(() => {
    const segments = 64;
    const positions: number[] = [];
    const colors: number[] = [];
    const n = frame.normal;
    const cx = frame.pos.x - n.x * 0.002;
    const cy = frame.pos.y - n.y * 0.002;
    const cz = frame.pos.z - n.z * 0.002;

    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const r = GROUND_RADIUS;

      positions.push(cx, cy, cz);
      colors.push(0.025, 0.04, 0.065);
      positions.push(
        cx + (frame.east.x * Math.cos(a0) + frame.north.x * Math.sin(a0)) * r,
        cy + (frame.east.y * Math.cos(a0) + frame.north.y * Math.sin(a0)) * r,
        cz + (frame.east.z * Math.cos(a0) + frame.north.z * Math.sin(a0)) * r
      );
      colors.push(0.008, 0.015, 0.03);
      positions.push(
        cx + (frame.east.x * Math.cos(a1) + frame.north.x * Math.sin(a1)) * r,
        cy + (frame.east.y * Math.cos(a1) + frame.north.y * Math.sin(a1)) * r,
        cz + (frame.east.z * Math.cos(a1) + frame.north.z * Math.sin(a1)) * r
      );
      colors.push(0.008, 0.015, 0.03);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -1;
    return mesh;
  }, [frame]);

  // Sky dome — hemisphere built in world space, vertex colors updated by useFrame
  const AZ_STEPS = 48;
  const EL_STEPS = 16;
  const skyData = useMemo(() => {
    const positions: number[] = [];
    const elevations: number[] = []; // store per-vertex elevation for color updates
    const azimuths: number[] = [];   // store per-vertex azimuth for sun-relative color
    const r = DOME_RADIUS * 1.1;
    const o = frame.pos;

    for (let ei = 0; ei < EL_STEPS; ei++) {
      const el0 = (ei / EL_STEPS) * 90;
      const el1 = ((ei + 1) / EL_STEPS) * 90;

      for (let ai = 0; ai < AZ_STEPS; ai++) {
        const az0 = (ai / AZ_STEPS) * 360;
        const az1 = ((ai + 1) / AZ_STEPS) * 360;

        const d00 = azElToDirection3D(frame, az0, el0);
        const d10 = azElToDirection3D(frame, az1, el0);
        const d01 = azElToDirection3D(frame, az0, el1);
        const d11 = azElToDirection3D(frame, az1, el1);

        // Triangle 1: d00, d10, d11
        positions.push(
          o.x + d00.x * r, o.y + d00.y * r, o.z + d00.z * r,
          o.x + d10.x * r, o.y + d10.y * r, o.z + d10.z * r,
          o.x + d11.x * r, o.y + d11.y * r, o.z + d11.z * r,
        );
        elevations.push(el0, el0, el1);
        azimuths.push(az0, az1, az1);

        // Triangle 2: d00, d11, d01
        positions.push(
          o.x + d00.x * r, o.y + d00.y * r, o.z + d00.z * r,
          o.x + d11.x * r, o.y + d11.y * r, o.z + d11.z * r,
          o.x + d01.x * r, o.y + d01.y * r, o.z + d01.z * r,
        );
        elevations.push(el0, el1, el1);
        azimuths.push(az0, az1, az0);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const colorArr = new Float32Array(positions.length); // same length, 3 per vertex
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colorArr, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -2;

    return { mesh, colorArr, elevations, azimuths };
  }, [frame]);

  // Update sky colors based on sun position
  useFrame(() => {
    const now = performance.now();
    if (now - lastSkyUpdate.current < SKY_UPDATE_MS) return;
    lastSkyUpdate.current = now;

    const sunDir = getSunDirection(new Date());
    // Sun position far away along its direction, compute az/el from observer
    const sunAzEl = computeAzElFrom(frame,
      sunDir.x * 100, sunDir.y * 100, sunDir.z * 100
    );
    const sunEl = sunAzEl.el;   // degrees
    const sunAz = sunAzEl.az;   // degrees

    const { colorArr, elevations, azimuths } = skyData;
    const vertCount = elevations.length;

    for (let i = 0; i < vertCount; i++) {
      const el = elevations[i];
      const az = azimuths[i];
      const ci = i * 3;

      const [r, g, b] = computeSkyVertexColor(el, az, sunEl, sunAz);
      colorArr[ci] = r;
      colorArr[ci + 1] = g;
      colorArr[ci + 2] = b;
    }

    const attr = skyData.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  // Horizon ring + compass ticks
  const horizonLines = useMemo(() => {
    const group = new THREE.Group();

    const ringPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const az = (i / 96) * 360;
      const dir = azElToDirection3D(frame, az, 0);
      ringPoints.push(new THREE.Vector3(
        frame.pos.x + dir.x * DOME_RADIUS,
        frame.pos.y + dir.y * DOME_RADIUS,
        frame.pos.z + dir.z * DOME_RADIUS
      ));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMat = new THREE.LineBasicMaterial({ color: '#55ccee', transparent: true, opacity: 0.9, depthWrite: false });
    group.add(new THREE.Line(ringGeo, ringMat));

    const tickMat = new THREE.LineBasicMaterial({ color: '#4499bb', transparent: true, opacity: 0.7, depthWrite: false });
    for (let deg = 0; deg < 360; deg += 10) {
      const isCardinal = deg % 90 === 0;
      const isIntercardinal = deg % 45 === 0 && !isCardinal;
      const tickElDeg = isCardinal ? 4 : isIntercardinal ? 2.5 : 1.2;

      const dirLo = azElToDirection3D(frame, deg, -0.5);
      const dirHi = azElToDirection3D(frame, deg, tickElDeg);
      const pts = [
        new THREE.Vector3(frame.pos.x + dirLo.x * DOME_RADIUS, frame.pos.y + dirLo.y * DOME_RADIUS, frame.pos.z + dirLo.z * DOME_RADIUS),
        new THREE.Vector3(frame.pos.x + dirHi.x * DOME_RADIUS, frame.pos.y + dirHi.y * DOME_RADIUS, frame.pos.z + dirHi.z * DOME_RADIUS),
      ];
      const tickGeo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(tickGeo, isCardinal ? ringMat : tickMat));
    }

    return group;
  }, [frame]);

  return (
    <group>
      <primitive object={groundMesh} />
      <primitive object={skyData.mesh} />
      <primitive object={horizonLines} />
    </group>
  );
}

/**
 * Compute sky color for a vertex based on its position and the sun.
 *
 * Sun elevation phases:
 *   > 10°  : Full day — bright blue sky
 *   0-10°  : Low sun — warm horizon glow
 *  -6 to 0°: Civil twilight — deep blue with orange horizon
 * -12 to -6°: Nautical twilight — dark blue
 * -18 to -12°: Astronomical twilight — very dark
 *   < -18° : Night — near black
 *
 * Vertex elevation and angular distance from sun affect the color.
 */
function computeSkyVertexColor(
  vertEl: number, vertAz: number,
  sunEl: number, sunAz: number
): [number, number, number] {
  const elFrac = vertEl / 90; // 0 at horizon, 1 at zenith

  // Angular distance from sun (simplified — just azimuth proximity at horizon)
  let dAz = Math.abs(vertAz - sunAz);
  if (dAz > 180) dAz = 360 - dAz;
  const sunProximity = Math.max(0, 1 - dAz / 90); // 1 near sun, 0 far away
  const nearHorizon = Math.max(0, 1 - vertEl / 15); // 1 at horizon, 0 above 15°

  if (sunEl > 10) {
    // Full day — blue sky, brighter near horizon (Rayleigh scattering)
    const r = 0.12 * (1 - elFrac * 0.5) + 0.05 * sunProximity * nearHorizon;
    const g = 0.22 * (1 - elFrac * 0.3) + 0.03 * sunProximity * nearHorizon;
    const b = 0.50 * (1 - elFrac * 0.2);
    return [r, g, b];
  }

  if (sunEl > 0) {
    // Low sun — warm glow near sun azimuth at horizon
    const dayFrac = sunEl / 10;
    const r = (0.08 + 0.15 * sunProximity * nearHorizon) * (0.5 + 0.5 * dayFrac);
    const g = (0.10 + 0.08 * sunProximity * nearHorizon) * (0.4 + 0.6 * dayFrac);
    const b = (0.25 * (1 - elFrac * 0.5)) * (0.3 + 0.7 * dayFrac);
    return [r, g, b];
  }

  if (sunEl > -6) {
    // Civil twilight — deep blue with orange/pink horizon glow near sun
    const twiFrac = (sunEl + 6) / 6; // 1 at sunset, 0 at -6°
    const glowR = 0.12 * sunProximity * nearHorizon * twiFrac;
    const glowG = 0.04 * sunProximity * nearHorizon * twiFrac;
    const r = 0.03 * (1 - elFrac * 0.7) + glowR;
    const g = 0.05 * (1 - elFrac * 0.6) + glowG;
    const b = 0.14 * (1 - elFrac * 0.5) * (0.4 + 0.6 * twiFrac);
    return [r, g, b];
  }

  if (sunEl > -12) {
    // Nautical twilight — dark blue, faint glow
    const twiFrac = (sunEl + 12) / 6; // 1 at -6°, 0 at -12°
    const r = 0.015 * (1 - elFrac * 0.7) * twiFrac;
    const g = 0.03 * (1 - elFrac * 0.6) * twiFrac;
    const b = 0.08 * (1 - elFrac * 0.5) * twiFrac;
    return [r, g, b];
  }

  if (sunEl > -18) {
    // Astronomical twilight — nearly black with faint horizon glow
    const twiFrac = (sunEl + 18) / 6;
    const r = 0.005 * twiFrac;
    const g = 0.01 * twiFrac;
    const b = 0.03 * (1 - elFrac * 0.5) * twiFrac;
    return [r, g, b];
  }

  // Full night — near black
  return [0.003, 0.005, 0.012 * (1 - elFrac * 0.5)];
}
