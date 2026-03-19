import { describe, it, expect } from 'vitest';
import { BRIGHT_STARS } from '@/data/bright-stars';

describe('bright-stars catalog', () => {
  it('has at least 100 stars', () => {
    expect(BRIGHT_STARS.length).toBeGreaterThan(100);
  });

  it('has at least 20 named stars', () => {
    const named = BRIGHT_STARS.filter((s) => s.name.length > 0);
    expect(named.length).toBeGreaterThanOrEqual(20);
  });

  it('all stars have valid RA in [0, 360)', () => {
    for (const star of BRIGHT_STARS) {
      expect(star.ra).toBeGreaterThanOrEqual(0);
      expect(star.ra).toBeLessThan(360);
    }
  });

  it('all stars have valid Dec in [-90, 90]', () => {
    for (const star of BRIGHT_STARS) {
      expect(star.dec).toBeGreaterThanOrEqual(-90);
      expect(star.dec).toBeLessThanOrEqual(90);
    }
  });

  it('all stars have magnitude <= 4.0', () => {
    for (const star of BRIGHT_STARS) {
      expect(star.mag).toBeLessThanOrEqual(4.0);
    }
  });

  it('Sirius is the brightest star', () => {
    const sirius = BRIGHT_STARS.find((s) => s.name === 'Sirius');
    expect(sirius).toBeDefined();
    expect(sirius!.mag).toBeLessThan(-1);
    // It should be the brightest
    const brightest = BRIGHT_STARS.reduce((a, b) => (a.mag < b.mag ? a : b));
    expect(brightest.name).toBe('Sirius');
  });

  it('Polaris is near the north celestial pole', () => {
    const polaris = BRIGHT_STARS.find((s) => s.name === 'Polaris');
    expect(polaris).toBeDefined();
    expect(polaris!.dec).toBeGreaterThan(85);
  });

  it('named stars cover both hemispheres', () => {
    const named = BRIGHT_STARS.filter((s) => s.name.length > 0);
    const northCount = named.filter((s) => s.dec > 0).length;
    const southCount = named.filter((s) => s.dec < 0).length;
    expect(northCount).toBeGreaterThan(5);
    expect(southCount).toBeGreaterThan(5);
  });

  it('B-V color index is in reasonable range [-0.5, 2.5]', () => {
    for (const star of BRIGHT_STARS) {
      expect(star.bv).toBeGreaterThanOrEqual(-0.5);
      expect(star.bv).toBeLessThanOrEqual(2.5);
    }
  });
});
