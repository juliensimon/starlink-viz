import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { geodeticToCartesian } from '../lib/utils/coordinates';
import { computeGeometricLatency } from '../lib/utils/geometric-latency';
import { GROUND_STATIONS, refreshGroundStations } from '../lib/satellites/ground-stations';
import { DISH_POS } from '../lib/utils/dish-frame';

/**
 * Tests for the satellite/GS selection improvements in ConnectionBeam.tsx:
 * - totalPathLength tiebreaker logic
 * - GS switch hysteresis
 * - Latency delta computation for event messages
 */

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const dishVec = { x: DISH_POS.x, y: DISH_POS.y, z: DISH_POS.z };

// Computed after HF data loads
let gsPositions: { x: number; y: number; z: number }[] = [];

beforeAll(async () => {
  await refreshGroundStations();
  gsPositions = GROUND_STATIONS.map((gs) => {
    const { x, y, z } = geodeticToCartesian(degToRad(gs.lat), degToRad(gs.lon), 0, 1);
    return { x, y, z };
  });
}, 15_000);

// Mirror the totalPathLength helper from ConnectionBeam.tsx
function totalPathLength(x: number, y: number, z: number): number {
  const dxD = x - dishVec.x, dyD = y - dishVec.y, dzD = z - dishVec.z;
  const distDish = Math.sqrt(dxD * dxD + dyD * dyD + dzD * dzD);
  let minGS = Infinity;
  for (let i = 0; i < gsPositions.length; i++) {
    const dxG = x - gsPositions[i].x, dyG = y - gsPositions[i].y, dzG = z - gsPositions[i].z;
    const d = Math.sqrt(dxG * dxG + dyG * dyG + dzG * dzG);
    if (d < minGS) minGS = d;
  }
  return distDish + minGS;
}

describe('totalPathLength — satellite path tiebreaker', () => {
  it('returns positive value for any satellite above Earth', () => {
    const satRadius = 1 + 550 / 6371;
    const path = totalPathLength(satRadius, 0, 0);
    expect(path).toBeGreaterThan(0);
  });

  it('shorter for satellite near dish + nearest GS', () => {
    // Satellite directly above the dish
    const satAboveDish = geodeticToCartesian(degToRad(48.91), degToRad(1.91), 550, 1);
    const pathNear = totalPathLength(satAboveDish.x, satAboveDish.y, satAboveDish.z);

    // Satellite on the opposite side of Earth
    const satFar = geodeticToCartesian(degToRad(-48.91), degToRad(-178.09), 550, 1);
    const pathFar = totalPathLength(satFar.x, satFar.y, satFar.z);

    expect(pathNear).toBeLessThan(pathFar);
  });

  it('increases with satellite altitude', () => {
    const satLow = geodeticToCartesian(degToRad(48.91), degToRad(1.91), 540, 1);
    const satHigh = geodeticToCartesian(degToRad(48.91), degToRad(1.91), 580, 1);

    const pathLow = totalPathLength(satLow.x, satLow.y, satLow.z);
    const pathHigh = totalPathLength(satHigh.x, satHigh.y, satHigh.z);

    expect(pathHigh).toBeGreaterThan(pathLow);
  });

  it('two satellites at similar elevation have different path lengths based on GS proximity', () => {
    // Both at 550km, but at different longitudes → different nearest GS distance
    const sat1 = geodeticToCartesian(degToRad(49.0), degToRad(2.0), 550, 1);
    const sat2 = geodeticToCartesian(degToRad(49.0), degToRad(30.0), 550, 1);

    const path1 = totalPathLength(sat1.x, sat1.y, sat1.z);
    const path2 = totalPathLength(sat2.x, sat2.y, sat2.z);

    // They should have different path lengths
    expect(path1).not.toBeCloseTo(path2, 3);
  });
});

describe('GS switch hysteresis', () => {
  // Mirrors the hysteresis logic from findNearestGS3D in ConnectionBeam.tsx
  function shouldSwitchGS(
    currentDist: number,
    newDist: number,
    margin: number = 0.95
  ): boolean {
    // Switch only if new GS is meaningfully closer
    return newDist <= currentDist * margin;
  }

  it('switches when new GS is >5% closer', () => {
    expect(shouldSwitchGS(1.0, 0.90)).toBe(true);
  });

  it('does NOT switch when new GS is only slightly closer (<5%)', () => {
    expect(shouldSwitchGS(1.0, 0.96)).toBe(false);
  });

  it('does NOT switch when distances are equal', () => {
    expect(shouldSwitchGS(1.0, 1.0)).toBe(false);
  });

  it('does NOT switch when new GS is farther', () => {
    expect(shouldSwitchGS(1.0, 1.1)).toBe(false);
  });

  it('switches at exact 5% boundary', () => {
    expect(shouldSwitchGS(1.0, 0.95)).toBe(true);
  });

  it('works with small distances', () => {
    expect(shouldSwitchGS(0.001, 0.0009)).toBe(true);
    expect(shouldSwitchGS(0.001, 0.00096)).toBe(false);
  });
});

describe('latency delta for event messages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes positive delta when switching to farther GS', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const sat = { x: 1 + 550 / 6371, y: 0, z: 0 };
    const gsNear = { x: 1, y: 0, z: 0 };
    const gsFar = { x: 0, y: 1, z: 0 };

    const latNear = computeGeometricLatency(dishVec, sat, gsNear);
    const latFar = computeGeometricLatency(dishVec, sat, gsFar);

    const delta = latFar - latNear;
    expect(delta).toBeGreaterThan(0);
  });

  it('computes negative delta when switching to closer GS', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const sat = { x: 1 + 550 / 6371, y: 0, z: 0 };
    const gsNear = { x: 1, y: 0, z: 0 };
    const gsFar = { x: 0, y: 1, z: 0 };

    const latFar = computeGeometricLatency(dishVec, sat, gsFar);
    const latNear = computeGeometricLatency(dishVec, sat, gsNear);

    const delta = latNear - latFar;
    expect(delta).toBeLessThan(0);
  });

  it('formats sign correctly for display', () => {
    const delta = 8.3;
    const sign = delta >= 0 ? '+' : '';
    expect(`${sign}${Math.round(delta)}ms`).toBe('+8ms');

    const negDelta = -3.7;
    const negSign = negDelta >= 0 ? '+' : '';
    expect(`${negSign}${Math.round(negDelta)}ms`).toBe('-4ms');
  });

  it('zero delta gets + prefix', () => {
    const delta = 0;
    const sign = delta >= 0 ? '+' : '';
    expect(`${sign}${Math.round(delta)}ms`).toBe('+0ms');
  });
});
