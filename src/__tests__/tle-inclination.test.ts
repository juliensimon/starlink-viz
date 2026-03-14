import { describe, it, expect } from 'vitest';
import { parseTLEText } from '../lib/satellites/tle-fetcher';

const SAMPLE_TLE = `STARLINK-1234
1 44235U 19029A   24001.50000000  .00000000  00000-0  00000-0 0  9999
2 44235  53.0000 100.0000 0001000  90.0000 270.0000 15.00000000    10`;

describe('parseTLEText', () => {
  it('parses inclination from TLE line 2', () => {
    const results = parseTLEText(SAMPLE_TLE);
    expect(results).toHaveLength(1);
    expect(results[0].inclination).toBeCloseTo(53.0, 4);
  });

  it('preserves satellite name', () => {
    const results = parseTLEText(SAMPLE_TLE);
    expect(results[0].name).toBe('STARLINK-1234');
  });

  it('stores both TLE lines', () => {
    const results = parseTLEText(SAMPLE_TLE);
    expect(results[0].line1).toMatch(/^1 44235/);
    expect(results[0].line2).toMatch(/^2 44235/);
  });

  it('parses high-inclination polar orbit (97.6°)', () => {
    const polarTle = `STARLINK-POLAR
1 99999U 24001A   24001.50000000  .00000000  00000-0  00000-0 0  9999
2 99999  97.6000 200.0000 0001500  45.0000 315.0000 15.20000000    10`;
    const results = parseTLEText(polarTle);
    expect(results[0].inclination).toBeCloseTo(97.6, 4);
  });

  it('parses zero inclination (equatorial)', () => {
    const eqTle = `EQUATORIAL-SAT
1 88888U 24002A   24001.50000000  .00000000  00000-0  00000-0 0  9999
2 88888   0.0000 000.0000 0000100  00.0000 000.0000 14.50000000    10`;
    const results = parseTLEText(eqTle);
    expect(results[0].inclination).toBeCloseTo(0.0, 4);
  });

  it('parses multiple satellites', () => {
    const multiTle = `SAT-A
1 11111U 20001A   24001.50000000  .00000000  00000-0  00000-0 0  9999
2 11111  53.0000 100.0000 0001000  90.0000 270.0000 15.00000000    10
SAT-B
1 22222U 20002A   24001.50000000  .00000000  00000-0  00000-0 0  9999
2 22222  70.0000 150.0000 0002000  45.0000 315.0000 14.80000000    10`;
    const results = parseTLEText(multiTle);
    expect(results).toHaveLength(2);
    expect(results[0].inclination).toBeCloseTo(53.0, 4);
    expect(results[1].inclination).toBeCloseTo(70.0, 4);
  });

  it('returns empty array for empty input', () => {
    expect(parseTLEText('')).toHaveLength(0);
  });

  it('skips malformed TLE entries', () => {
    const badTle = `BAD-SAT
X invalid line 1
Y invalid line 2`;
    expect(parseTLEText(badTle)).toHaveLength(0);
  });

  it('handles extra whitespace and blank lines', () => {
    const spacedTle = `
  STARLINK-1234
  1 44235U 19029A   24001.50000000  .00000000  00000-0  00000-0 0  9999
  2 44235  53.0000 100.0000 0001000  90.0000 270.0000 15.00000000    10

`;
    const results = parseTLEText(spacedTle);
    expect(results).toHaveLength(1);
    expect(results[0].inclination).toBeCloseTo(53.0, 4);
  });
});
