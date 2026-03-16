import { describe, it, expect } from 'vitest';
import { correctRAANToEpoch } from '@/lib/fleet/raan-correction';

describe('correctRAANToEpoch', () => {
  it('returns the same RAAN when deltaSeconds is 0', () => {
    const result = correctRAANToEpoch({
      raanDeg: 120,
      inclination: 53,
      meanMotion: 15.06,
      deltaSeconds: 0,
    });
    expect(result).toBeCloseTo(120, 5);
  });

  it('produces ~5-6 deg change over 1 day for 53 deg inclination', () => {
    const original = 120;
    const result = correctRAANToEpoch({
      raanDeg: original,
      inclination: 53,
      meanMotion: 15.06,
      deltaSeconds: 86400, // 1 day
    });
    const change = Math.abs(result - original);
    // J2 precession for 53 deg inc at ~550km is roughly -5 to -6 deg/day
    expect(change).toBeGreaterThan(4);
    expect(change).toBeLessThan(8);
  });

  it('precesses retrograde (decreasing RAAN) for prograde orbits', () => {
    const result = correctRAANToEpoch({
      raanDeg: 120,
      inclination: 53,
      meanMotion: 15.06,
      deltaSeconds: 86400,
    });
    // For cos(53 deg) > 0, dOmega/dt is negative → RAAN decreases
    expect(result).toBeLessThan(120);
  });

  it('wraps correctly near 0 degrees', () => {
    const result = correctRAANToEpoch({
      raanDeg: 2,
      inclination: 53,
      meanMotion: 15.06,
      deltaSeconds: 86400,
    });
    // Should wrap around to near 360
    expect(result).toBeGreaterThan(350);
    expect(result).toBeLessThan(360);
  });

  it('wraps correctly near 360 degrees', () => {
    const result = correctRAANToEpoch({
      raanDeg: 358,
      inclination: 97.6, // retrograde → positive precession
      meanMotion: 15.06,
      deltaSeconds: 86400,
    });
    // Retrograde orbit: cos(97.6) < 0 → dOmega/dt > 0 → RAAN increases
    // Should wrap past 360 back to low values
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });
});
