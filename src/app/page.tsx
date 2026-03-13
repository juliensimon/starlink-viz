'use client';

import { Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import HudContainer from '@/components/hud/HudContainer';
import LoadingScreen from '@/components/LoadingScreen';
import SatelliteTooltipOverlay from '@/components/SatelliteTooltipOverlay';
import WebSocketManager from '@/components/WebSocketManager';
import { useAppStore } from '@/stores/app-store';

const Scene = dynamic(() => import('@/components/scene/Scene'), {
  ssr: false,
});

// Error boundary for WebGL context loss (headless browsers, low-end GPUs)
class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            background: '#0a0e1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00ffff',
            fontFamily: 'monospace',
            fontSize: '14px',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <div>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>WebGL Context Lost</div>
            <div style={{ color: 'rgba(255,255,255,0.5)' }}>
              3D rendering requires a GPU-capable browser.<br />
              Try reloading or opening in Chrome/Firefox with hardware acceleration enabled.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  const satellitesLoaded = useAppStore((s) => s.satellitesLoaded);

  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <WebSocketManager />
      <SceneErrorBoundary>
        <Scene />
      </SceneErrorBoundary>
      <HudContainer />
      <SatelliteTooltipOverlay />
      <LoadingScreen loaded={satellitesLoaded} />
    </main>
  );
}
