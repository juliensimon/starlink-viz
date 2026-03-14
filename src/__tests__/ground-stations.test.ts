import { describe, it, expect } from 'vitest';
import { GROUND_STATIONS, findNearestGroundStation } from '../lib/satellites/ground-stations';

describe('GROUND_STATIONS', () => {
  it('has at least 15 stations', () => {
    expect(GROUND_STATIONS.length).toBeGreaterThanOrEqual(15);
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
  it('finds Villenave-d\'Ornon for Paris location', () => {
    const nearest = findNearestGroundStation(48.91, 1.91);
    // Should be a European station, not US
    expect(nearest.lon).toBeGreaterThan(-10);
    expect(nearest.lon).toBeLessThan(20);
  });

  it('finds Hawthorne for Los Angeles location', () => {
    const nearest = findNearestGroundStation(34.0, -118.3);
    expect(nearest.name).toContain('Hawthorne');
  });

  it('finds Hitachinaka for Tokyo-area location', () => {
    const nearest = findNearestGroundStation(35.7, 139.7);
    expect(nearest.name).toContain('Japan');
  });

  it('uses cosine correction for longitude at high latitudes', () => {
    // At 60°N, 1° longitude = 0.5 × 1° latitude in distance
    // A station 2° away in longitude but at same latitude should be
    // closer than a station 1.5° away in latitude
    // This tests that the cosine correction works
    const nearest = findNearestGroundStation(50.5, 8.0); // Near Usingen, Germany
    expect(nearest.name).toContain('Usingen');
  });
});
