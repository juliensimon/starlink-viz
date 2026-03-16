import { describe, it, expect } from 'vitest';
import { filterStarlinkName, parseLaunchInfo } from '../lib/fleet/ingest-helpers';

describe('filterStarlinkName', () => {
  it('accepts STARLINK-1234', () => {
    expect(filterStarlinkName('STARLINK-1234')).toBe(true);
  });

  it('accepts STARLINK-60001', () => {
    expect(filterStarlinkName('STARLINK-60001')).toBe(true);
  });

  it('rejects STARSHIELD-1', () => {
    expect(filterStarlinkName('STARSHIELD-1')).toBe(false);
  });

  it('rejects OBJECT A', () => {
    expect(filterStarlinkName('OBJECT A')).toBe(false);
  });

  it('rejects TBA - TO BE ASSIGNED', () => {
    expect(filterStarlinkName('TBA - TO BE ASSIGNED')).toBe(false);
  });
});

describe('parseLaunchInfo', () => {
  it('parses 19029A → {year:2019,launch:29}', () => {
    expect(parseLaunchInfo('19029A')).toEqual({ year: 2019, launch: 29 });
  });

  it('parses 98067A → {year:1998,launch:67}', () => {
    expect(parseLaunchInfo('98067A')).toEqual({ year: 1998, launch: 67 });
  });

  it('parses 24045B → {year:2024,launch:45}', () => {
    expect(parseLaunchInfo('24045B')).toEqual({ year: 2024, launch: 45 });
  });
});
