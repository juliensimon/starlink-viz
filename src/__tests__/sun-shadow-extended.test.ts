import { describe, it, expect } from 'vitest';
import { isSunBelowHorizon, isSatelliteSunlit } from '@/lib/utils/sun-shadow';
import { getSunDirection } from '@/lib/utils/astronomy';
import { computeObserverFrame } from '@/lib/utils/observer-frame';

describe('sun shadow integration with real sun direction', () => {
  it('sun is below horizon at midnight UTC for Paris (48.9°N, 1.9°E) in winter', () => {
    const frame = computeObserverFrame(48.9, 1.9);
    const sunDir = getSunDirection(new Date('2026-01-15T00:00:00Z'));
    const below = isSunBelowHorizon(
      frame.normal.x, frame.normal.y, frame.normal.z,
      sunDir.x, sunDir.y, sunDir.z
    );
    expect(below).toBe(true);
  });

  it('sun is above horizon at noon UTC for Paris in summer', () => {
    const frame = computeObserverFrame(48.9, 1.9);
    const sunDir = getSunDirection(new Date('2026-07-15T12:00:00Z'));
    const below = isSunBelowHorizon(
      frame.normal.x, frame.normal.y, frame.normal.z,
      sunDir.x, sunDir.y, sunDir.z
    );
    expect(below).toBe(false);
  });

  it('LEO satellite at noon is sunlit', () => {
    // Satellite directly above Paris at noon — definitely sunlit
    const frame = computeObserverFrame(48.9, 1.9);
    const satX = frame.normal.x * 1.08; // ~510 km altitude
    const satY = frame.normal.y * 1.08;
    const satZ = frame.normal.z * 1.08;
    const sunDir = getSunDirection(new Date('2026-07-15T12:00:00Z'));
    expect(isSatelliteSunlit(satX, satY, satZ, sunDir.x, sunDir.y, sunDir.z)).toBe(true);
  });
});

describe('observer-frame sun elevation', () => {
  it('sun elevation is positive at local noon', () => {
    // At 48.9°N, 1.9°E, local noon is ~12:00 UTC (close enough)
    const frame = computeObserverFrame(48.9, 1.9);
    const sunDir = getSunDirection(new Date('2026-06-21T11:00:00Z'));
    // Dot product of sun direction with observer normal ≈ sin(sun elevation)
    const sinEl = sunDir.x * frame.normal.x + sunDir.y * frame.normal.y + sunDir.z * frame.normal.z;
    expect(sinEl).toBeGreaterThan(0);
  });

  it('sun elevation is negative at local midnight in winter', () => {
    // Winter solstice, midnight UTC — sun well below horizon at 48.9°N
    const frame = computeObserverFrame(48.9, 1.9);
    const sunDir = getSunDirection(new Date('2026-12-21T00:00:00Z'));
    const sinEl = sunDir.x * frame.normal.x + sunDir.y * frame.normal.y + sunDir.z * frame.normal.z;
    expect(sinEl).toBeLessThan(0);
  });
});
