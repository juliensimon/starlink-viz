import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeGeometricLatency } from '../lib/utils/geometric-latency';

describe('computeGeometricLatency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a value in ~20-40ms range for typical LEO geometry', () => {
    // Fix Math.random to remove jitter variance
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // Dish at surface on equator/prime meridian (unit sphere radius = 1.0)
    const dish = { x: 1.0, y: 0, z: 0 };

    // Satellite at 550km altitude directly above (radius = 1 + 550/6371 ≈ 1.0863)
    const satRadius = 1 + 550 / 6371;
    const sat = { x: satRadius, y: 0, z: 0 };

    // Gateway at surface, slightly offset (e.g. 5° away in longitude)
    const angle = (5 * Math.PI) / 180;
    const gateway = { x: Math.cos(angle), y: 0, z: -Math.sin(angle) };

    const latency = computeGeometricLatency(dish, sat, gateway);

    // Typical Starlink latency from geometric path is ~20-40ms
    expect(latency).toBeGreaterThan(10);
    expect(latency).toBeLessThan(50);
  });

  it('result is always positive', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const dish = { x: 1, y: 0, z: 0 };
    const sat = { x: 1.086, y: 0, z: 0 };
    const gateway = { x: 0, y: 1, z: 0 };

    const latency = computeGeometricLatency(dish, sat, gateway);
    expect(latency).toBeGreaterThan(0);
  });

  it('increases when satellite is farther from dish', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const dish = { x: 1, y: 0, z: 0 };
    const gateway = { x: 0, y: 1, z: 0 };

    const satClose = { x: 1 + 550 / 6371, y: 0, z: 0 };
    const satFar = { x: 1 + 1200 / 6371, y: 0, z: 0 };

    const latClose = computeGeometricLatency(dish, satClose, gateway);
    const latFar = computeGeometricLatency(dish, satFar, gateway);

    expect(latFar).toBeGreaterThan(latClose);
  });

  it('includes jitter offset of 3-7ms', () => {
    const dish = { x: 1, y: 0, z: 0 };
    const sat = { x: 1.086, y: 0, z: 0 };
    const gateway = { x: 1, y: 0, z: 0 }; // co-located with dish for minimal path

    // With random = 0, jitter = 3 + 0 = 3
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const latMin = computeGeometricLatency(dish, sat, gateway);

    // With random = 1, jitter = 3 + 4 = 7
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const latMax = computeGeometricLatency(dish, sat, gateway);

    expect(latMax - latMin).toBeCloseTo(4, 1);
  });
});
