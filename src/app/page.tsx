'use client';

import dynamic from 'next/dynamic';
import HudContainer from '@/components/hud/HudContainer';
import LoadingScreen from '@/components/LoadingScreen';
import SatelliteTooltipOverlay from '@/components/SatelliteTooltipOverlay';
import { useAppStore } from '@/stores/app-store';

const Scene = dynamic(() => import('@/components/scene/Scene'), {
  ssr: false,
});

export default function Home() {
  const satellitesLoaded = useAppStore((s) => s.satellitesLoaded);

  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <Scene />
      <HudContainer />
      <SatelliteTooltipOverlay />
      <LoadingScreen loaded={satellitesLoaded} />
    </main>
  );
}
