'use client';

import dynamic from 'next/dynamic';
import HudContainer from '@/components/hud/HudContainer';

const Scene = dynamic(() => import('@/components/scene/Scene'), {
  ssr: false,
});

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <Scene />
      <HudContainer />
    </main>
  );
}
