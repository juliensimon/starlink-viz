'use client';

import { useState, useEffect } from 'react';

interface LoadingScreenProps {
  loaded: boolean;
}

export default function LoadingScreen({ loaded }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (loaded) {
      setFadeOut(true);
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [loaded]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: '#0a0e1a',
        transition: 'opacity 500ms ease-out',
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      {/* Skeleton HUD panels */}
      <div className="absolute inset-0 p-4 md:p-6 pointer-events-none">
        {/* Top-left skeleton */}
        <div className="absolute top-4 left-4 md:top-6 md:left-6">
          <div className="hud-panel w-48 h-20 animate-pulse opacity-30" />
        </div>
        {/* Top-right skeleton */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <div className="hud-panel w-56 h-32 animate-pulse opacity-30" />
        </div>
        {/* Bottom-left skeleton */}
        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
          <div className="hud-panel w-64 h-28 animate-pulse opacity-30" />
        </div>
        {/* Bottom-right skeleton */}
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6">
          <div className="hud-panel w-52 h-24 animate-pulse opacity-30" />
        </div>
      </div>

      {/* Center text */}
      <div className="text-center z-10">
        <div className="text-lg md:text-2xl font-semibold tracking-[0.3em] uppercase hud-glow-text-strong animate-pulse">
          ACQUIRING SIGNAL...
        </div>
        <div className="mt-3 text-xs text-[var(--color-text-dim)] tracking-[0.15em] uppercase opacity-60">
          Loading satellite data...
        </div>
      </div>
    </div>
  );
}
