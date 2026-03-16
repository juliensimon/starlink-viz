import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, DEMO_LOCATIONS } from '../stores/app-store';

describe('demo location management', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      demoMode: false,
      demoLocation: null,
    });
  });

  it('starts with demoLocation null in live mode', () => {
    expect(useAppStore.getState().demoMode).toBe(false);
    expect(useAppStore.getState().demoLocation).toBeNull();
  });

  it('setDemoMode(true) sets Iceland Gap as default location', () => {
    useAppStore.getState().setDemoMode(true);

    const state = useAppStore.getState();
    expect(state.demoMode).toBe(true);
    expect(state.demoLocation).not.toBeNull();
    expect(state.demoLocation!.name).toBe('Iceland Gap');
    expect(state.demoLocation).toBe(DEMO_LOCATIONS[0]);
  });

  it('setDemoMode(false) clears demoLocation', () => {
    useAppStore.getState().setDemoMode(true);
    expect(useAppStore.getState().demoLocation).not.toBeNull();

    useAppStore.getState().setDemoMode(false);
    expect(useAppStore.getState().demoMode).toBe(false);
    expect(useAppStore.getState().demoLocation).toBeNull();
  });

  it('setDemoLocation allows switching to another location', () => {
    useAppStore.getState().setDemoMode(true);
    const celtic = DEMO_LOCATIONS.find((l) => l.name === 'Celtic Sea')!;

    useAppStore.getState().setDemoLocation(celtic);

    expect(useAppStore.getState().demoLocation!.name).toBe('Celtic Sea');
    expect(useAppStore.getState().demoLocation!.pop).toBe('Washington DC, US');
  });

  it('setDemoLocation(null) reverts to dish default', () => {
    useAppStore.getState().setDemoMode(true);
    useAppStore.getState().setDemoLocation(null);

    expect(useAppStore.getState().demoMode).toBe(true);
    expect(useAppStore.getState().demoLocation).toBeNull();
  });

  it('toggling demo off then on resets to Iceland Gap', () => {
    useAppStore.getState().setDemoMode(true);
    const gulf = DEMO_LOCATIONS.find((l) => l.name === 'Gulf of Mexico')!;
    useAppStore.getState().setDemoLocation(gulf);
    expect(useAppStore.getState().demoLocation!.name).toBe('Gulf of Mexico');

    useAppStore.getState().setDemoMode(false);
    useAppStore.getState().setDemoMode(true);

    expect(useAppStore.getState().demoLocation!.name).toBe('Iceland Gap');
  });

  it('DEMO_LOCATIONS all have required fields', () => {
    expect(DEMO_LOCATIONS.length).toBe(5);
    for (const loc of DEMO_LOCATIONS) {
      expect(loc.name).toBeTruthy();
      expect(typeof loc.lat).toBe('number');
      expect(typeof loc.lon).toBe('number');
      expect(loc.pop).toBeTruthy();
      expect(loc.description).toBeTruthy();
      // Lat/lon in valid range
      expect(loc.lat).toBeGreaterThanOrEqual(-90);
      expect(loc.lat).toBeLessThanOrEqual(90);
      expect(loc.lon).toBeGreaterThanOrEqual(-180);
      expect(loc.lon).toBeLessThanOrEqual(180);
    }
  });

  it('all demo location PoPs exist in POP_LOCATIONS', async () => {
    // Import dynamically to avoid circular deps in test
    // POP_LOCATIONS is internal to isl-pathfinder, so we verify indirectly:
    // each PoP name must match a key in the known set.
    const knownPops = [
      'Frankfurt, DE', 'London, GB', 'Madrid, ES', 'Los Angeles, US',
      'Seattle, US', 'Chicago, US', 'Washington DC, US', 'Miami, US',
      'Amsterdam, NL', 'Paris, FR', 'Singapore, SG', 'Sydney, AU', 'Tokyo, JP',
    ];
    for (const loc of DEMO_LOCATIONS) {
      expect(knownPops).toContain(loc.pop);
    }
  });
});
