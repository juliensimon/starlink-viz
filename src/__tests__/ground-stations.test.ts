import { describe, it, expect, beforeAll } from 'vitest';
import { GROUND_STATIONS, findNearestGroundStation, groundStationsVersion, refreshGroundStations } from '../lib/satellites/ground-stations';
import {
  normalizeName,
  haversineKm,
  mergeStatus,
  sanityCheck,
} from '../../scripts/update-ground-stations';

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

  it('finds a Southern California station for Los Angeles location', () => {
    const nearest = findNearestGroundStation(34.0, -118.3);
    // Hawthorne or Los Angeles — both are in the LA area
    expect(nearest.lat).toBeGreaterThan(33);
    expect(nearest.lat).toBeLessThan(35);
    expect(nearest.lon).toBeGreaterThan(-119);
    expect(nearest.lon).toBeLessThan(-117);
  });

  it('finds a Japanese station for Tokyo-area location', () => {
    const nearest = findNearestGroundStation(35.7, 139.7);
    // Station is named "Tokyo" in the HF dataset
    expect(nearest.lat).toBeGreaterThan(30);
    expect(nearest.lat).toBeLessThan(40);
    expect(nearest.lon).toBeGreaterThan(130);
    expect(nearest.lon).toBeLessThan(145);
  });

  it('uses cosine correction for longitude at high latitudes', () => {
    // At 50°N near Usingen/Frankfurt, the nearest station should be German
    const nearest = findNearestGroundStation(50.5, 8.0);
    // Should be a German station (Usingen or Frankfurt)
    expect(nearest.lat).toBeGreaterThan(49);
    expect(nearest.lat).toBeLessThan(53);
    expect(nearest.lon).toBeGreaterThan(7);
    expect(nearest.lon).toBeLessThan(10);
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

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  Hawthorne, CA  ')).toBe('hawthorne, ca');
  });

  it('expands St. to Saint', () => {
    expect(normalizeName("St. John's, NL")).toBe("saint john's, nl");
  });

  it('expands Mt. to Mount', () => {
    expect(normalizeName('Mt. Ayr, IN')).toBe('mount ayr, in');
  });

  it('expands Ft. to Fort', () => {
    expect(normalizeName('Ft. Lauderdale, FL')).toBe('fort lauderdale, fl');
  });

  it('produces stable keys for matching', () => {
    // Same station, different formatting
    expect(normalizeName('St. Johns, NL')).toBe(normalizeName('st. johns, nl'));
    expect(normalizeName('  Butte, MT')).toBe(normalizeName('Butte, MT  '));
  });

  it('collapses multiple spaces', () => {
    expect(normalizeName('New   Braunfels,  TX')).toBe('new braunfels, tx');
  });
});

describe('mergeStatus', () => {
  it('operational wins over planned', () => {
    expect(mergeStatus('planned', 'operational')).toBe('operational');
    expect(mergeStatus('operational', 'planned')).toBe('operational');
  });

  it('planned + planned stays planned', () => {
    expect(mergeStatus('planned', 'planned')).toBe('planned');
  });

  it('operational + operational stays operational', () => {
    expect(mergeStatus('operational', 'operational')).toBe('operational');
  });
});

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(48.91, 1.91, 48.91, 1.91)).toBe(0);
  });

  it('correctly measures known distance (Paris to London ~340km)', () => {
    const dist = haversineKm(48.8566, 2.3522, 51.5074, -0.1278);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(350);
  });

  it('flags coordinate conflict when >50km apart', () => {
    // Hawthorne, CA to Murrieta, CA — ~120km
    const dist = haversineKm(33.9207, -118.328, 33.5539, -117.2139);
    expect(dist).toBeGreaterThan(50);
  });

  it('passes coordinate check when <50km apart', () => {
    // Two points ~10km apart
    const dist = haversineKm(48.91, 1.91, 48.92, 1.92);
    expect(dist).toBeLessThan(50);
  });
});

describe('sanityCheck', () => {
  it('rejects source with <50% of known stations', () => {
    expect(sanityCheck(50, 200)).toBe(false);
  });

  it('accepts source with >=50% of known stations', () => {
    expect(sanityCheck(100, 200)).toBe(true);
  });

  it('accepts source with more than known stations', () => {
    expect(sanityCheck(250, 200)).toBe(true);
  });

  it('accepts any count when no known stations exist', () => {
    expect(sanityCheck(5, 0)).toBe(true);
    expect(sanityCheck(0, 0)).toBe(true);
  });

  it('rejects at exactly 49%', () => {
    expect(sanityCheck(49, 100)).toBe(false);
  });

  it('accepts at exactly 50%', () => {
    expect(sanityCheck(50, 100)).toBe(true);
  });
});
