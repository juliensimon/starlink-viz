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

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 45 }}
      style={{ width: '100vw', height: '100vh' }}
      gl={{ antialias: true, alpha: false }}
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
