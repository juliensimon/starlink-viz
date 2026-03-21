import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/app-store';

describe('app-store sky view state', () => {
  beforeEach(() => {
    // Reset store to defaults
    useAppStore.setState({
      cameraMode: 'space',
      satellitesVersion: 0,
      satellitesLoaded: false,
    });
  });

  it('defaults to space camera mode', () => {
    expect(useAppStore.getState().cameraMode).toBe('space');
  });

  it('setCameraMode switches to sky', () => {
    useAppStore.getState().setCameraMode('sky');
    expect(useAppStore.getState().cameraMode).toBe('sky');
  });

  it('setCameraMode switches back to space', () => {
    useAppStore.getState().setCameraMode('sky');
    useAppStore.getState().setCameraMode('space');
    expect(useAppStore.getState().cameraMode).toBe('space');
  });

  it('satellitesVersion starts at 0', () => {
    expect(useAppStore.getState().satellitesVersion).toBe(0);
  });

  it('bumpSatellitesVersion increments', () => {
    useAppStore.getState().bumpSatellitesVersion();
    expect(useAppStore.getState().satellitesVersion).toBe(1);
    useAppStore.getState().bumpSatellitesVersion();
    expect(useAppStore.getState().satellitesVersion).toBe(2);
  });

  it('bumpSatellitesVersion triggers re-renders (version changes)', () => {
    const v1 = useAppStore.getState().satellitesVersion;
    useAppStore.getState().bumpSatellitesVersion();
    const v2 = useAppStore.getState().satellitesVersion;
    expect(v2).toBeGreaterThan(v1);
  });
});
