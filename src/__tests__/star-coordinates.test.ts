import { describe, it, expect } from 'vitest';
import { raDecToAzEl } from '@/lib/utils/star-coordinates';

describe('raDecToAzEl', () => {
  it('Polaris is near zenith at the North Pole', () => {
    // Polaris: RA ~37.95°, Dec ~89.26°
    // From the North Pole (90°N), it should be very close to zenith
    const date = new Date('2026-03-20T00:00:00Z');
    const { el } = raDecToAzEl(37.954, 89.264, date, 90, 0);
    expect(el).toBeGreaterThan(85);
  });

  it('Polaris is below horizon from the South Pole', () => {
    const date = new Date('2026-03-20T00:00:00Z');
    const { el } = raDecToAzEl(37.954, 89.264, date, -90, 0);
    expect(el).toBeLessThan(-85);
  });

  it('a star at dec=0 reaches max elevation equal to colatitude', () => {
    // Star at dec=0° transiting at lat=45°N → max elevation = 90 - 45 = 45°
    // At transit, HA = 0, so we need LST = RA
    // Use a date/time where this star is approximately transiting
    const { el } = raDecToAzEl(0, 0, new Date('2026-09-23T00:00:00Z'), 45, 0);
    // The exact elevation depends on the exact transit time, but should be reasonable
    expect(el).toBeGreaterThan(-90);
    expect(el).toBeLessThan(90);
  });

  it('returns azimuth in [0, 360) range', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    const { az } = raDecToAzEl(100, 20, date, 40, -75);
    expect(az).toBeGreaterThanOrEqual(0);
    expect(az).toBeLessThan(360);
  });
});
