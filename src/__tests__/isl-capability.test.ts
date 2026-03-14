import { describe, it, expect } from 'vitest';
import { isISLCapable, parseRAANFromTLE, computeISLArrays } from '../lib/satellites/isl-capability';

describe('isISLCapable', () => {
  it('polar shells are always ISL-capable', () => {
    expect(isISLCapable(70, 2019)).toBe(true);
    expect(isISLCapable(97.6, 2018)).toBe(true);
    expect(isISLCapable(80, 2020)).toBe(true);
  });

  it('53° shell requires launch >= 2022', () => {
    expect(isISLCapable(53, 2021)).toBe(false);
    expect(isISLCapable(53, 2022)).toBe(true);
    expect(isISLCapable(53, 2024)).toBe(true);
    expect(isISLCapable(50, 2022)).toBe(true); // 48-60° range
  });

  it('43° shell requires launch >= 2023', () => {
    expect(isISLCapable(43, 2022)).toBe(false);
    expect(isISLCapable(43, 2023)).toBe(true);
    expect(isISLCapable(40, 2023)).toBe(true);
  });

  it('33° shell requires launch >= 2024', () => {
    expect(isISLCapable(33, 2023)).toBe(false);
    expect(isISLCapable(33, 2024)).toBe(true);
    expect(isISLCapable(30, 2025)).toBe(true);
  });

  it('boundary inclinations are correctly classified', () => {
    // 60° is polar (>= 60)
    expect(isISLCapable(60, 2019)).toBe(true);
    // 48° is 53° shell
    expect(isISLCapable(48, 2021)).toBe(false);
    expect(isISLCapable(48, 2022)).toBe(true);
    // 38° is 43° shell
    expect(isISLCapable(38, 2022)).toBe(false);
    expect(isISLCapable(38, 2023)).toBe(true);
  });
});

describe('parseRAANFromTLE', () => {
  it('parses RAAN from valid TLE line 2', () => {
    // Standard TLE format: cols 17-25 contain RAAN
    const line2 = '2 25544  51.6439 236.5400 0004429 269.8571  90.2025 15.48919755349985';
    const raan = parseRAANFromTLE(line2);
    expect(raan).toBeCloseTo(236.54, 1);
  });

  it('returns 0 for invalid RAAN', () => {
    expect(parseRAANFromTLE('')).toBe(0);
    expect(parseRAANFromTLE('2 25544  51.6439         ')).toBe(0);
  });
});

describe('computeISLArrays', () => {
  it('correctly populates arrays', () => {
    const lines2 = [
      '2 25544  53.0000 120.0000 0004429 269.8571  90.2025 15.48919755349985',
      '2 25545  70.0000 240.0000 0004429 269.8571  90.2025 15.48919755349985',
    ];
    const inclinations = new Float32Array([53, 70]);
    const launchYears = new Uint16Array([2022, 2020]);

    const { raanArray, islCapableArray } = computeISLArrays(lines2, inclinations, launchYears, 2);

    expect(raanArray[0]).toBeCloseTo(120, 0);
    expect(raanArray[1]).toBeCloseTo(240, 0);
    expect(islCapableArray[0]).toBe(1); // 53° + 2022
    expect(islCapableArray[1]).toBe(1); // 70° always
  });

  it('marks old 53° sats as not ISL-capable', () => {
    const lines2 = [
      '2 25544  53.0000 120.0000 0004429 269.8571  90.2025 15.48919755349985',
    ];
    const inclinations = new Float32Array([53]);
    const launchYears = new Uint16Array([2020]);

    const { islCapableArray } = computeISLArrays(lines2, inclinations, launchYears, 1);
    expect(islCapableArray[0]).toBe(0);
  });
});
