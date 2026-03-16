import { describe, it, expect, beforeEach } from 'vitest';
import { setTLEData, getNoradId, getLaunchInfo } from '../lib/satellites/satellite-store';

// Realistic TLE lines for testing (STARLINK-1007)
const SAMPLE_TLE = {
  name: 'STARLINK-1007',
  line1: '1 44713U 19074A   24076.91667824  .00001234  00000-0  12345-3 0  9991',
  line2: '2 44713  53.0536 120.4567 0001234 123.4567 234.5678 15.06789012345678',
  inclination: 53.0536,
};

// TLE with 1900s year designator
const OLD_TLE = {
  name: 'OLD-SAT',
  line1: '1 25544U 98067A   24076.91667824  .00001234  00000-0  12345-3 0  9991',
  line2: '2 25544  51.6400 247.4627 0006703  69.9862  35.6694 15.54815968455001',
  inclination: 51.64,
};

describe('satellite-store pure functions', () => {
  beforeEach(() => {
    setTLEData([SAMPLE_TLE, OLD_TLE]);
  });

  describe('getNoradId', () => {
    it('extracts NORAD ID from TLE line 1', () => {
      expect(getNoradId(0)).toBe('44713');
    });

    it('extracts NORAD ID for second satellite', () => {
      expect(getNoradId(1)).toBe('25544');
    });

    it('returns --- for out-of-range index', () => {
      expect(getNoradId(99)).toBe('---');
    });
  });

  describe('getLaunchInfo', () => {
    it('parses 2000s launch year (19 → 2019)', () => {
      const info = getLaunchInfo(0);
      expect(info).not.toBeNull();
      expect(info!.year).toBe(2019);
      expect(info!.launch).toBe('074');
    });

    it('parses 1900s launch year (98 → 1998)', () => {
      const info = getLaunchInfo(1);
      expect(info).not.toBeNull();
      expect(info!.year).toBe(1998);
      expect(info!.launch).toBe('067');
    });

    it('returns null for out-of-range index', () => {
      expect(getLaunchInfo(99)).toBeNull();
    });
  });
});
