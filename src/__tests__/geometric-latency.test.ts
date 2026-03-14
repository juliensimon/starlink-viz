import { describe, it, expect } from 'vitest';
import { computeGeometricLatency } from '../lib/utils/geometric-latency';

describe('computeGeometricLatency', () => {
  it('returns a value in ~20-40ms range for typical LEO geometry', () => {
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
    const dish = { x: 1, y: 0, z: 0 };
    const sat = { x: 1.086, y: 0, z: 0 };
    const gateway = { x: 0, y: 1, z: 0 };

    const latency = computeGeometricLatency(dish, sat, gateway);
    expect(latency).toBeGreaterThan(0);
  });

  it('increases when satellite is farther from dish', () => {
    const dish = { x: 1, y: 0, z: 0 };
    const gateway = { x: 0, y: 1, z: 0 };

    const satClose = { x: 1 + 550 / 6371, y: 0, z: 0 };
    const satFar = { x: 1 + 1200 / 6371, y: 0, z: 0 };

    const latClose = computeGeometricLatency(dish, satClose, gateway);
    const latFar = computeGeometricLatency(dish, satFar, gateway);

    expect(latFar).toBeGreaterThan(latClose);
  });

  it('is deterministic (no random jitter)', () => {
    const dish = { x: 1, y: 0, z: 0 };
    const sat = { x: 1.086, y: 0, z: 0 };
    const gateway = { x: 1, y: 0, z: 0 };

    const lat1 = computeGeometricLatency(dish, sat, gateway);
    const lat2 = computeGeometricLatency(dish, sat, gateway);

    expect(lat1).toBe(lat2);
  });

  it('includes 6ms base processing delay', () => {
    // Co-located dish, sat, gateway → distance ~0 → latency ≈ 6ms (base processing only)
    const dish = { x: 1, y: 0, z: 0 };
    const sat = { x: 1, y: 0, z: 0 };
    const gateway = { x: 1, y: 0, z: 0 };

    const latency = computeGeometricLatency(dish, sat, gateway);
    expect(latency).toBeCloseTo(6, 0);
  });
});
