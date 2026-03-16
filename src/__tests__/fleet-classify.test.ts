import { describe, it, expect } from 'vitest';
import { classifySatelliteStatus, getShellId } from '@/lib/fleet/classify';

describe('classifySatelliteStatus', () => {
  it('returns decayed for negative altitude', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: -10,
      eccentricity: 0.0001,
      epochAgeHours: 1,
      altitudeHistory: [100, 50, -10],
    });
    expect(result).toBe('decayed');
  });

  it('returns decayed for altitude above 2000 km', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: 2500,
      eccentricity: 0.0001,
      epochAgeHours: 1,
      altitudeHistory: [2400, 2450, 2500],
    });
    expect(result).toBe('decayed');
  });

  it('returns decayed for stale epoch and low altitude', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: 200,
      eccentricity: 0.0001,
      epochAgeHours: 400, // > 336 (14 days)
      altitudeHistory: [210, 205, 200],
    });
    expect(result).toBe('decayed');
  });

  it('returns anomalous for high eccentricity', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: 550,
      eccentricity: 0.01,
      epochAgeHours: 1,
      altitudeHistory: [550, 550, 550],
    });
    expect(result).toBe('anomalous');
  });

  it('returns operational for satellite at correct altitude', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: 550,
      eccentricity: 0.0001,
      epochAgeHours: 1,
      altitudeHistory: [550, 550, 550],
    });
    expect(result).toBe('operational');
  });

  it('returns raising for satellite climbing toward operational altitude', () => {
    // Shell 2 (53 deg) minAlt is 460. 430 is 30km below (>20km).
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: 430,
      eccentricity: 0.0001,
      epochAgeHours: 1,
      altitudeHistory: [400, 415, 430],
    });
    expect(result).toBe('raising');
  });

  it('returns deorbiting for satellite descending with sufficient rate', () => {
    // Below minAlt (460), decreasing, rate > 1 km/day
    // 3 points spread over time, all decreasing
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: 350,
      eccentricity: 0.0001,
      epochAgeHours: 1,
      altitudeHistory: [380, 365, 350],
      altitudeTimestamps: [0, 86400, 172800], // 2 days span, 30km drop = 15 km/day
    });
    expect(result).toBe('deorbiting');
  });

  it('returns unknown for fewer than 3 history points', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: 350,
      eccentricity: 0.0001,
      epochAgeHours: 1,
      altitudeHistory: [350, 340],
    });
    expect(result).toBe('unknown');
  });

  it('returns unknown when no classification matches', () => {
    // Below minAlt but not consistently increasing or decreasing
    const result = classifySatelliteStatus({
      inclination: 53,
      altitudeKm: 430,
      eccentricity: 0.0001,
      epochAgeHours: 1,
      altitudeHistory: [440, 420, 430], // neither all increasing nor all decreasing
    });
    expect(result).toBe('unknown');
  });
});

describe('getShellId', () => {
  it('maps 33 deg to shell 0', () => {
    expect(getShellId(33)).toBe(0);
  });

  it('maps 43 deg to shell 1', () => {
    expect(getShellId(43)).toBe(1);
  });

  it('maps 53 deg to shell 2', () => {
    expect(getShellId(53)).toBe(2);
  });

  it('maps 70 deg to shell 3', () => {
    expect(getShellId(70)).toBe(3);
  });

  it('maps 97.6 deg to shell 4', () => {
    expect(getShellId(97.6)).toBe(4);
  });

  it('returns 2 as fallback for unknown inclination', () => {
    // 150 falls within shell 4 (80-180). Use a value outside all bands.
    // SHELL_ALT_BANDS covers 0-180, so all positive inclinations are covered.
    // Test with a negative value to trigger fallback.
    expect(getShellId(-1)).toBe(2);
  });
});
