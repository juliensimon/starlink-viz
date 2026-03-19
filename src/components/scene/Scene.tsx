'use client';

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import Globe from './Globe';
import Atmosphere from './Atmosphere';
import SceneSetup from './SceneSetup';
import Satellites from './Satellites';
import SatellitePropagator from './SatellitePropagator';
import DishMarker from './DishMarker';
import GroundStations from './GroundStations';
import ConnectionBeam from './ConnectionBeam';
import SatelliteTooltip from './SatelliteTooltip';
import GpsSatellites from './GpsSatellites';
import Sun from './Sun';
import Moon from './Moon';
import SkyView from './SkyView';
import { useAppStore } from '@/stores/app-store';

export default function Scene() {
  const cameraMode = useAppStore((s) => s.cameraMode);

  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 45 }}
      style={{ width: '100vw', height: '100vh' }}
      gl={{ antialias: true }}
      scene={{ background: new THREE.Color('#0a0e1a') }}
    >
      <SatellitePropagator />
      {/* ConnectionBeam always mounted — drives satellite selection, handovers,
          az/el updates. Its visuals are hidden in sky mode via the group. */}
      <group visible={cameraMode === 'space'}>
        <ConnectionBeam />
      </group>
      {cameraMode === 'space' ? (
        <>
          <Globe />
          <Atmosphere />
          <Sun />
          <Moon />
          <Satellites />
          <GpsSatellites />
          <DishMarker />
          <GroundStations />
          <SatelliteTooltip />
          <SceneSetup />
        </>
      ) : (
        <SkyView />
      )}
    </Canvas>
  );
}
