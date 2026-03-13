'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  uniform vec3 glowColor;
  uniform float intensity;
  uniform float power;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = 1.0 - dot(viewDirection, vNormal);
    fresnel = pow(fresnel, power);
    float alpha = fresnel * intensity;
    gl_FragColor = vec4(glowColor, alpha);
  }
`;

export default function Atmosphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(0.3, 0.6, 1.0) },
      intensity: { value: 1.2 },
      power: { value: 3.5 },
    }),
    []
  );

  return (
    <mesh ref={meshRef} scale={[1.02, 1.02, 1.02]}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}
