import { describe, it, expect } from 'vitest';
import { isSunBelowHorizon, isSatelliteSunlit } from '@/lib/utils/sun-shadow';

describe('isSunBelowHorizon', () => {
  it('returns true when sun direction opposes normal', () => {
    // Observer at "north pole" (normal = +Y), sun below (pointing -Y)
    expect(isSunBelowHorizon(0, 1, 0, 0, -1, 0)).toBe(true);
  });

  it('returns false when sun direction aligns with normal', () => {
    // Observer at "north pole", sun above (pointing +Y)
    expect(isSunBelowHorizon(0, 1, 0, 0, 1, 0)).toBe(false);
  });

  it('returns true at exactly zero (grazing)', () => {
    // Sun perpendicular to normal = on horizon, dot = 0, which is < 0 is false
    expect(isSunBelowHorizon(0, 1, 0, 1, 0, 0)).toBe(false);
  });
});

describe('isSatelliteSunlit', () => {
  it('satellite on sun-side of Earth is sunlit', () => {
    // Sun direction = +X, satellite at (2, 0, 0) — sun-side
    expect(isSatelliteSunlit(2, 0, 0, 1, 0, 0)).toBe(true);
  });

  it('satellite directly behind Earth in shadow is not sunlit', () => {
    // Sun direction = +X, satellite at (-2, 0, 0) — directly behind, on axis
    // perpendicular distance = 0, which is < 1.0
    expect(isSatelliteSunlit(-2, 0, 0, 1, 0, 0)).toBe(false);
  });

  it('satellite behind Earth but far off-axis is sunlit', () => {
    // Sun direction = +X, satellite at (-1, 2, 0) — behind Earth but far off axis
    // dot = -1, perp = (0, 2, 0), perpDistSq = 4 > 1.0
    expect(isSatelliteSunlit(-1, 2, 0, 1, 0, 0)).toBe(true);
  });

  it('satellite behind Earth but just inside shadow cylinder', () => {
    // Sun direction = +X, satellite at (-2, 0.5, 0)
    // dot = -2, perp = (0, 0.5, 0), perpDistSq = 0.25 < 1.0
    expect(isSatelliteSunlit(-2, 0.5, 0, 1, 0, 0)).toBe(false);
  });

  it('satellite at LEO altitude behind Earth on shadow edge', () => {
    // Sun = +X, satellite at (-1.08, 0, 1.0) — at ~1.47 radius
    // dot = -1.08, perp = (0, 0, 1.0), perpDistSq = 1.0 — exactly on edge
    // > 1.0 is false, so this is NOT sunlit (boundary)
    expect(isSatelliteSunlit(-1.08, 0, 1.0, 1, 0, 0)).toBe(false);
  });

  it('satellite just outside shadow cylinder is sunlit', () => {
    // Sun = +X, satellite at (-1.08, 0, 1.01)
    // dot = -1.08, perp = (0, 0, 1.01), perpDistSq = 1.0201 > 1.0
    expect(isSatelliteSunlit(-1.08, 0, 1.01, 1, 0, 0)).toBe(true);
  });
});
