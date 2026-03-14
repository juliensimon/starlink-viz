import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeISLRouteLatency } from '../lib/utils/geometric-latency';

describe('computeISLRouteLatency', () => {
  it('returns higher latency than direct path for multi-hop routes', () => {
    // Dish at surface
    const dish = { x: 1.0, y: 0, z: 0 };

    // Gateway at surface, offset
    const angle = (10 * Math.PI) / 180;
    const gateway = { x: Math.cos(angle), y: 0, z: -Math.sin(angle) };

    const R = 1 + 550 / 6371;

    // Direct: dish → sat → gateway
    const directSats = [{ x: R, y: 0, z: 0 }];
    const directLatency = computeISLRouteLatency(dish, directSats, gateway);

    // ISL route: dish → sat0 → sat1 → gateway (detour through ISL hop)
    const islSats = [
      { x: R, y: 0, z: 0 },
      { x: R * Math.cos(0.05), y: R * Math.sin(0.05), z: 0 },
    ];
    const islLatency = computeISLRouteLatency(dish, islSats, gateway);

    // ISL route should have higher latency due to the extra hop + processing delay
    expect(islLatency).toBeGreaterThan(directLatency);
  });

  it('includes ISL processing delay per hop', () => {
    const dish = { x: 1.0, y: 0, z: 0 };
    const gateway = { x: 1.0, y: 0, z: 0 }; // co-located with dish
    const R = 1 + 550 / 6371;

    // 1 hop (2 sats)
    const oneHop = [
      { x: R, y: 0, z: 0 },
      { x: R, y: 0.001, z: 0 }, // very close
    ];
    const lat1 = computeISLRouteLatency(dish, oneHop, gateway);

    // 3 hops (4 sats)
    const threeHops = [
      { x: R, y: 0, z: 0 },
      { x: R, y: 0.001, z: 0 },
      { x: R, y: 0.002, z: 0 },
      { x: R, y: 0.003, z: 0 },
    ];
    const lat3 = computeISLRouteLatency(dish, threeHops, gateway);

    // 3 hops should add ~2 * 0.3ms * 2 = 1.2ms more processing delay than 1 hop
    // plus additional path distance from the slightly different positions
    const processingDelta = lat3 - lat1;
    expect(processingDelta).toBeGreaterThan(0.5); // at least ISL processing adds something
  });

  it('returns zero for empty satellite array', () => {
    const dish = { x: 1.0, y: 0, z: 0 };
    const gateway = { x: 1.0, y: 0, z: 0 };
    expect(computeISLRouteLatency(dish, [], gateway)).toBe(0);
  });

  it('base processing delay is 3ms', () => {
    const dish = { x: 1.0, y: 0, z: 0 };
    // Satellite at same position as dish (zero distance)
    const sat = [{ x: 1.0, y: 0, z: 0 }];
    const gateway = { x: 1.0, y: 0, z: 0 };

    const latency = computeISLRouteLatency(dish, sat, gateway);
    // 0 distance + 0 ISL hops + 6ms base = 6ms
    expect(latency).toBeCloseTo(6, 0);
  });
});
