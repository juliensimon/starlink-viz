'use client';

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import Globe from './Globe';
import Atmosphere from './Atmosphere';
import SceneSetup from './SceneSetup';
import Satellites from './Satellites';
import DishMarker from './DishMarker';
import GroundStations from './GroundStations';
import ConnectionBeam from './ConnectionBeam';
import SatelliteTooltip from './SatelliteTooltip';

// Firefox bug: WebGL2RenderingContext.getContextAttributes() returns null,
// crashing both R3F Canvas init and postprocessing EffectComposer.
// Patch at module level so it runs before any Canvas renders.
if (typeof window !== 'undefined' && typeof WebGL2RenderingContext !== 'undefined') {
  const origGetCA = WebGL2RenderingContext.prototype.getContextAttributes;
  WebGL2RenderingContext.prototype.getContextAttributes = function () {
    return origGetCA.call(this) ?? {
      alpha: true,
      antialias: true,
      depth: true,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'default' as WebGLPowerPreference,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: true,
      desynchronized: false,
      xrCompatible: false,
    };
  };
}

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 45 }}
      style={{ width: '100vw', height: '100vh' }}
      gl={{ antialias: true }}
      scene={{ background: new THREE.Color('#0a0e1a') }}
    >
      <Globe />
      <Atmosphere />
      <Satellites />
      <DishMarker />
      <GroundStations />
      <ConnectionBeam />
      <SatelliteTooltip />
      <SceneSetup />
    </Canvas>
  );
}
