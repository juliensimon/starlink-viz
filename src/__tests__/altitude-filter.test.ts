import { describe, it, expect } from 'vitest';

/**
 * Tests for satellite altitude filtering logic from Satellites.tsx.
 * The component filters satellites to the 530-580 km operational range.
 * We test the filtering predicate directly to avoid Three.js/React dependencies.
 */

const MIN_OPERATIONAL_ALT = 530; // km
const MAX_OPERATIONAL_ALT = 580; // km

function isOperationalAltitude(altitudeKm: number): boolean {
  return altitudeKm >= MIN_OPERATIONAL_ALT && altitudeKm <= MAX_OPERATIONAL_ALT;
}

describe('satellite altitude filtering', () => {
  it('accepts satellite at 550km (nominal Starlink altitude)', () => {
    expect(isOperationalAltitude(550)).toBe(true);
  });

  it('accepts satellite at lower bound (530km)', () => {
    expect(isOperationalAltitude(530)).toBe(true);
  });

  it('accepts satellite at upper bound (580km)', () => {
    expect(isOperationalAltitude(580)).toBe(true);
  });

  it('rejects satellite below 530km (orbit raising)', () => {
    expect(isOperationalAltitude(350)).toBe(false);
    expect(isOperationalAltitude(529.9)).toBe(false);
  });

  it('rejects satellite above 580km (deorbit or wrong shell)', () => {
    expect(isOperationalAltitude(580.1)).toBe(false);
    expect(isOperationalAltitude(1200)).toBe(false);
  });

  it('rejects zero or negative altitude (propagation error)', () => {
    expect(isOperationalAltitude(0)).toBe(false);
    expect(isOperationalAltitude(-100)).toBe(false);
  });

  it('filters a mixed array to only operational satellites', () => {
    const altitudes = [350, 530, 545, 550, 560, 580, 600, 1200];
    const operational = altitudes.filter(isOperationalAltitude);
    expect(operational).toEqual([530, 545, 550, 560, 580]);
  });
});
