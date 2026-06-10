/**
 * Regression tests for the 5km dedup pass in scripts/update-ground-stations.ts.
 *
 * Bug history: dedup merged purely by distance + name length, so a co-located
 * 'pop' record (e.g. "Salt Lake City, UT") could replace a 'gateway'
 * ("Fair Park, UT") wholesale — and isl-pathfinder excludes type 'pop' from
 * routing, silently dropping the gateway after the weekly auto-update.
 */
import { describe, it, expect } from 'vitest';
import { dedupNearbyStations, stationsEqual, type Station } from '../../scripts/update-ground-stations';

function station(overrides: Partial<Station>): Station {
  return {
    name: 'Test, XX',
    lat: 40.0,
    lon: -111.9,
    status: 'operational',
    type: 'gateway',
    ...overrides,
  };
}

describe('dedupNearbyStations', () => {
  it('merges two gateways within 5km, keeping the longer name', () => {
    const result = dedupNearbyStations([
      station({ name: 'Seatle, WA', lat: 47.60, lon: -122.33 }),
      station({ name: 'Seattle, WA', lat: 47.61, lon: -122.33 }),
    ]);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Seattle, WA');
    expect(result[0].type).toBe('gateway');
  });

  it('never merges a pop with a co-located gateway', () => {
    const result = dedupNearbyStations([
      station({ name: 'Fair Park, UT', lat: 40.77, lon: -111.93, type: 'gateway' }),
      station({ name: 'Salt Lake City, UT', lat: 40.79, lon: -111.95, type: 'pop' }),
    ]);
    expect(result.length).toBe(2);
    const types = result.map((s) => s.type).sort();
    expect(types).toEqual(['gateway', 'pop']);
  });

  it('merging keeps operational status when one record is planned', () => {
    const result = dedupNearbyStations([
      station({ name: 'Short, FR', status: 'planned' }),
      station({ name: 'Longer Name, FR', lat: 40.01, status: 'operational' }),
    ]);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('operational');
  });

  it('leaves distant stations untouched', () => {
    const result = dedupNearbyStations([
      station({ name: 'Paris, FR', lat: 48.85, lon: 2.35 }),
      station({ name: 'London, UK', lat: 51.5, lon: -0.13 }),
    ]);
    expect(result.length).toBe(2);
  });
});

describe('stationsEqual', () => {
  // Bug history: the script rewrote data/ground-stations.json with a fresh
  // lastUpdated on every run, so the weekly workflow opened a timestamp-only
  // PR even when no station changed.
  it('treats identical station lists as equal', () => {
    const a = [station({ name: 'A' }), station({ name: 'B', lat: 41 })];
    const b = [station({ name: 'A' }), station({ name: 'B', lat: 41 })];
    expect(stationsEqual(a, b)).toBe(true);
  });

  it('detects any field change', () => {
    expect(stationsEqual([station({})], [station({ status: 'planned' })])).toBe(false);
    expect(stationsEqual([station({})], [station({ lat: 40.001 })])).toBe(false);
  });

  it('detects added/removed stations', () => {
    expect(stationsEqual([station({})], [station({}), station({ name: 'X' })])).toBe(false);
  });
});
