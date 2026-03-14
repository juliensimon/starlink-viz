'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { getMoonDirection } from '@/lib/utils/astronomy';

const MOON_DISTANCE = 15;
const UPDATE_INTERVAL = 2; // seconds

// Moon angular diameter ~0.52° → at distance 15, radius ≈ 15 * tan(0.26°) ≈ 0.068
const MOON_RADIUS = 0.068;

// Subtle glow shader for the Moon
const moonGlowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const moonGlowFragmentShader = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = 1.0 - dot(viewDirection, vNormal);
    fresnel = pow(fresnel, 4.0);
    float alpha = fresnel * 0.4;
    gl_FragColor = vec4(glowColor, alpha);
  }
`;

export default function Moon() {
  const moonRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const moonDirRef = useRef(getMoonDirection(new Date()));

  const moonTexture = useTexture('/textures/moon.jpg');

  const glowUniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(0.7, 0.75, 0.85) },
    }),
    []
  );

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    if (elapsedRef.current >= UPDATE_INTERVAL) {
      elapsedRef.current = 0;
      moonDirRef.current = getMoonDirection(new Date());
    }

    if (moonRef.current) {
      const pos = moonDirRef.current.clone().multiplyScalar(MOON_DISTANCE);
      moonRef.current.position.copy(pos);
    }
  });

  const initialPos = moonDirRef.current.clone().multiplyScalar(MOON_DISTANCE);

  return (
    <group ref={moonRef} position={initialPos.toArray()}>
      {/* Moon sphere — lit by the scene's directional light (sun), so phase is natural */}
      <mesh>
        <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
        <meshStandardMaterial
          map={moonTexture}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Subtle Fresnel glow halo */}
      <mesh scale={[1.15, 1.15, 1.15]}>
        <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
        <shaderMaterial
          vertexShader={moonGlowVertexShader}
          fragmentShader={moonGlowFragmentShader}
          uniforms={glowUniforms}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
