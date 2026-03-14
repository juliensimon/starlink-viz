import { describe, it, expect } from 'vitest';

/**
 * Tests for the shell color classification logic used in Satellites.tsx.
 * getDimColor maps inclination → shell color. The reversed comparison order
 * ensures NaN (from missing/corrupt data) falls through to the default (amber/33°)
 * instead of the polar shell (red).
 */

// Mirror the getDimColor logic from Satellites.tsx
const BLUE = 'blue';     // 53° main shell
const TEAL = 'teal';     // 43° shell
const AMBER = 'amber';   // 33° shell
const GREEN = 'green';   // 70° shell
const RED = 'red';       // 97.6° polar shell

function getDimColor(inclination: number): string {
  if (inclination >= 80) return RED;      // 97.6° polar
  if (inclination >= 60) return GREEN;    // 70° shell
  if (inclination >= 48) return BLUE;     // 53° main shell
  if (inclination >= 38) return TEAL;     // 43° shell
  return AMBER;                           // 33° shell
}

describe('getDimColor — shell color classification', () => {
  it('53° inclination → blue (main shell)', () => {
    expect(getDimColor(53)).toBe(BLUE);
  });

  it('43° inclination → teal (43° shell)', () => {
    expect(getDimColor(43)).toBe(TEAL);
  });

  it('33° inclination → amber (33° shell)', () => {
    expect(getDimColor(33)).toBe(AMBER);
  });

  it('70° inclination → green (mid shell)', () => {
    expect(getDimColor(70)).toBe(GREEN);
  });

  it('97.6° inclination → red (polar shell)', () => {
    expect(getDimColor(97.6)).toBe(RED);
  });

  it('0° inclination → amber (equatorial → 33° bucket)', () => {
    expect(getDimColor(0)).toBe(AMBER);
  });

  it('37.9° → amber (just under teal threshold)', () => {
    expect(getDimColor(37.9)).toBe(AMBER);
  });

  it('38° → teal (exact 43° shell boundary)', () => {
    expect(getDimColor(38)).toBe(TEAL);
  });

  it('47.9° → teal (just under blue threshold)', () => {
    expect(getDimColor(47.9)).toBe(TEAL);
  });

  it('48° → blue (exact 53° shell boundary)', () => {
    expect(getDimColor(48)).toBe(BLUE);
  });

  it('59.9° → blue (just under green threshold)', () => {
    expect(getDimColor(59.9)).toBe(BLUE);
  });

  it('60° → green (exact boundary)', () => {
    expect(getDimColor(60)).toBe(GREEN);
  });

  it('79.9° → green (just under red threshold)', () => {
    expect(getDimColor(79.9)).toBe(GREEN);
  });

  it('80° → red (exact boundary)', () => {
    expect(getDimColor(80)).toBe(RED);
  });

  // NaN falls through all >= comparisons to the default bucket
  it('NaN → amber (safe default, not red)', () => {
    expect(getDimColor(NaN)).toBe(AMBER);
  });

  it('negative inclination → amber', () => {
    expect(getDimColor(-10)).toBe(AMBER);
  });

  it('Infinity → red', () => {
    expect(getDimColor(Infinity)).toBe(RED);
  });
});

describe('client-side inclination parsing from TLE line2', () => {
  // Mirrors the parsing logic in Satellites.tsx useEffect
  function parseInclinationFromLine2(line2: string): number {
    const inc = parseFloat(line2.substring(8, 16));
    return isNaN(inc) ? 53 : inc;
  }

  it('parses 53° from standard Starlink TLE', () => {
    const line2 = '2 44235  53.0000 100.0000 0001000  90.0000 270.0000 15.00000000    10';
    expect(parseInclinationFromLine2(line2)).toBeCloseTo(53.0, 4);
  });

  it('parses 43° from 43-shell TLE', () => {
    const line2 = '2 66666  43.0000 120.0000 0001500  60.0000 300.0000 15.10000000    10';
    expect(parseInclinationFromLine2(line2)).toBeCloseTo(43.0, 4);
  });

  it('parses 33° from 33-shell TLE', () => {
    const line2 = '2 77777  33.0000 130.0000 0001200  50.0000 310.0000 15.05000000    10';
    expect(parseInclinationFromLine2(line2)).toBeCloseTo(33.0, 4);
  });

  it('parses 70° from mid-shell TLE', () => {
    const line2 = '2 55555  70.0000 150.0000 0002000  45.0000 315.0000 14.80000000    10';
    expect(parseInclinationFromLine2(line2)).toBeCloseTo(70.0, 4);
  });

  it('parses 97.6° from polar TLE', () => {
    const line2 = '2 99999  97.6000 200.0000 0001500  45.0000 315.0000 15.20000000    10';
    expect(parseInclinationFromLine2(line2)).toBeCloseTo(97.6, 4);
  });

  it('returns 53 for malformed line2', () => {
    expect(parseInclinationFromLine2('garbage')).toBe(53);
  });

  it('returns 53 for empty string', () => {
    expect(parseInclinationFromLine2('')).toBe(53);
  });

  it('parsed inclination produces correct shell color', () => {
    const line53 = '2 44235  53.0000 100.0000 0001000  90.0000 270.0000 15.00000000    10';
    const line43 = '2 66666  43.0000 120.0000 0001500  60.0000 300.0000 15.10000000    10';
    const line33 = '2 77777  33.0000 130.0000 0001200  50.0000 310.0000 15.05000000    10';
    const line70 = '2 55555  70.0000 150.0000 0002000  45.0000 315.0000 14.80000000    10';
    const line97 = '2 99999  97.6000 200.0000 0001500  45.0000 315.0000 15.20000000    10';

    expect(getDimColor(parseInclinationFromLine2(line53))).toBe(BLUE);
    expect(getDimColor(parseInclinationFromLine2(line43))).toBe(TEAL);
    expect(getDimColor(parseInclinationFromLine2(line33))).toBe(AMBER);
    expect(getDimColor(parseInclinationFromLine2(line70))).toBe(GREEN);
    expect(getDimColor(parseInclinationFromLine2(line97))).toBe(RED);
  });

  it('malformed data → blue (fallback to 53°)', () => {
    // Missing inclination field → undefined in Float32Array → NaN → parseInclination returns 53
    expect(getDimColor(parseInclinationFromLine2('bad'))).toBe(BLUE);
  });
});
