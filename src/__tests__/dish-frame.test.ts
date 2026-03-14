import { describe, it, expect } from 'vitest';
import { DISH_POS, DISH_NORMAL, DISH_EAST, DISH_NORTH, computeAzEl, azElToDirection } from '../lib/utils/dish-frame';

describe('dish frame', () => {
  it('dish position is on the unit sphere', () => {
    const dist = Math.sqrt(DISH_POS.x ** 2 + DISH_POS.y ** 2 + DISH_POS.z ** 2);
    expect(dist).toBeCloseTo(1, 4);
  });

  it('dish normal is unit length', () => {
    const len = Math.sqrt(DISH_NORMAL.x ** 2 + DISH_NORMAL.y ** 2 + DISH_NORMAL.z ** 2);
    expect(len).toBeCloseTo(1, 6);
  });

  it('east vector is unit length', () => {
    const len = Math.sqrt(DISH_EAST.x ** 2 + DISH_EAST.y ** 2 + DISH_EAST.z ** 2);
    expect(len).toBeCloseTo(1, 6);
  });

  it('north vector is unit length', () => {
    const len = Math.sqrt(DISH_NORTH.x ** 2 + DISH_NORTH.y ** 2 + DISH_NORTH.z ** 2);
    expect(len).toBeCloseTo(1, 6);
  });

  it('frame vectors are orthogonal', () => {
    const en = DISH_EAST.x * DISH_NORTH.x + DISH_EAST.y * DISH_NORTH.y + DISH_EAST.z * DISH_NORTH.z;
    const eu = DISH_EAST.x * DISH_NORMAL.x + DISH_EAST.y * DISH_NORMAL.y + DISH_EAST.z * DISH_NORMAL.z;
    const nu = DISH_NORTH.x * DISH_NORMAL.x + DISH_NORTH.y * DISH_NORMAL.y + DISH_NORTH.z * DISH_NORMAL.z;
    expect(en).toBeCloseTo(0, 6);
    expect(eu).toBeCloseTo(0, 6);
    expect(nu).toBeCloseTo(0, 6);
  });

  it('dish Y is positive (northern hemisphere)', () => {
    expect(DISH_POS.y).toBeGreaterThan(0.7);
  });
});

describe('computeAzEl', () => {
  it('returns 90° elevation for point directly above dish', () => {
    // Point directly above dish at 2x radius
    const above = { x: DISH_NORMAL.x * 2, y: DISH_NORMAL.y * 2, z: DISH_NORMAL.z * 2 };
    const { el } = computeAzEl(above.x, above.y, above.z);
    expect(el).toBeCloseTo(90, 0);
  });

  it('returns ~0° elevation for point on the horizon', () => {
    // Point in the east direction at dish surface level
    const horizon = {
      x: DISH_POS.x + DISH_EAST.x * 0.1,
      y: DISH_POS.y + DISH_EAST.y * 0.1,
      z: DISH_POS.z + DISH_EAST.z * 0.1,
    };
    const { el } = computeAzEl(horizon.x, horizon.y, horizon.z);
    expect(el).toBeCloseTo(0, 0);
  });

  it('azimuth wraps to 0-360', () => {
    // Point to the north at some elevation
    const north = {
      x: DISH_POS.x + DISH_NORTH.x * 0.1 + DISH_NORMAL.x * 0.1,
      y: DISH_POS.y + DISH_NORTH.y * 0.1 + DISH_NORMAL.y * 0.1,
      z: DISH_POS.z + DISH_NORTH.z * 0.1 + DISH_NORMAL.z * 0.1,
    };
    const { az } = computeAzEl(north.x, north.y, north.z);
    expect(az % 360).toBeCloseTo(0, 0); // North = 0° azimuth
  });

  it('east direction gives ~90° azimuth', () => {
    const east = {
      x: DISH_POS.x + DISH_EAST.x * 0.1 + DISH_NORMAL.x * 0.1,
      y: DISH_POS.y + DISH_EAST.y * 0.1 + DISH_NORMAL.y * 0.1,
      z: DISH_POS.z + DISH_EAST.z * 0.1 + DISH_NORMAL.z * 0.1,
    };
    const { az } = computeAzEl(east.x, east.y, east.z);
    expect(az).toBeCloseTo(90, 0);
  });
});

describe('azElToDirection', () => {
  it('zenith (el=90) returns dish normal', () => {
    const dir = azElToDirection(0, 90);
    expect(dir.x).toBeCloseTo(DISH_NORMAL.x, 4);
    expect(dir.y).toBeCloseTo(DISH_NORMAL.y, 4);
    expect(dir.z).toBeCloseTo(DISH_NORMAL.z, 4);
  });

  it('az=0,el=0 returns north direction', () => {
    const dir = azElToDirection(0, 0);
    expect(dir.x).toBeCloseTo(DISH_NORTH.x, 4);
    expect(dir.y).toBeCloseTo(DISH_NORTH.y, 4);
    expect(dir.z).toBeCloseTo(DISH_NORTH.z, 4);
  });

  it('az=90,el=0 returns east direction', () => {
    const dir = azElToDirection(90, 0);
    expect(dir.x).toBeCloseTo(DISH_EAST.x, 4);
    expect(dir.y).toBeCloseTo(DISH_EAST.y, 4);
    expect(dir.z).toBeCloseTo(DISH_EAST.z, 4);
  });

  it('returns unit vectors', () => {
    const dir = azElToDirection(-42, 69.5);
    const len = Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2);
    expect(len).toBeCloseTo(1, 6);
  });

  it('roundtrips with computeAzEl', () => {
    const az = 135, el = 45;
    const dir = azElToDirection(az, el);
    // Place a point in that direction from dish
    const px = DISH_POS.x + dir.x * 0.5;
    const py = DISH_POS.y + dir.y * 0.5;
    const pz = DISH_POS.z + dir.z * 0.5;
    const result = computeAzEl(px, py, pz);
    expect(result.az).toBeCloseTo(az, 1);
    expect(result.el).toBeCloseTo(el, 1);
  });
});
