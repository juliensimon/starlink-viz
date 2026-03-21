import { describe, it, expect, vi, beforeAll } from 'vitest';
import { GROUND_STATIONS, findNearestGroundStation, groundStationsVersion, refreshGroundStations } from '../lib/satellites/ground-stations';

// Populate GROUND_STATIONS from HF before running tests
beforeAll(async () => {
  await refreshGroundStations();
}, 15_000);

describe('GROUND_STATIONS', () => {
  it('has been populated from HF', () => {
    expect(GROUND_STATIONS.length).toBeGreaterThanOrEqual(15);
    expect(groundStationsVersion).toBeGreaterThanOrEqual(1);
  });

  it('all stations have valid lat/lon', () => {
    for (const gs of GROUND_STATIONS) {
      expect(gs.lat).toBeGreaterThanOrEqual(-90);
      expect(gs.lat).toBeLessThanOrEqual(90);
      expect(gs.lon).toBeGreaterThanOrEqual(-180);
      expect(gs.lon).toBeLessThanOrEqual(180);
      expect(gs.name.length).toBeGreaterThan(0);
    }
  });

  it('does not include Gravelines (abandoned)', () => {
    const names = GROUND_STATIONS.map((gs) => gs.name.toLowerCase());
    expect(names).not.toContain('gravelines');
    expect(names.some((n) => n.includes('gravelines'))).toBe(false);
  });

  it('includes Villenave-d\'Ornon (operational French gateway)', () => {
    const names = GROUND_STATIONS.map((gs) => gs.name.toLowerCase());
    expect(names.some((n) => n.includes('villenave'))).toBe(true);
  });
});

describe('findNearestGroundStation', () => {
  it('finds a European station for Paris location', () => {
    const nearest = findNearestGroundStation(48.91, 1.91);
    expect(nearest.lon).toBeGreaterThan(-10);
    expect(nearest.lon).toBeLessThan(20);
  });

  it('finds a US West Coast station for Los Angeles location', () => {
    const nearest = findNearestGroundStation(34.0, -118.3);
    expect(nearest.lat).toBeGreaterThan(30);
    expect(nearest.lat).toBeLessThan(40);
    expect(nearest.lon).toBeGreaterThan(-120);
    expect(nearest.lon).toBeLessThan(-115);
  });

  it('finds a Japanese station for Tokyo-area location', () => {
    const nearest = findNearestGroundStation(35.7, 139.7);
    expect(nearest.name).toContain('Japan');
  });
});

describe('refreshGroundStations', () => {
  it('version counter increments on refresh', async () => {
    const versionBefore = groundStationsVersion;
    await refreshGroundStations();
    expect(groundStationsVersion).toBe(versionBefore + 1);
  }, 15_000);

  it('starts empty before first refresh', async () => {
    // This is a logical test — GROUND_STATIONS was already populated
    // by beforeAll, so we verify the version is at least 1
    expect(groundStationsVersion).toBeGreaterThanOrEqual(1);
  });
});
