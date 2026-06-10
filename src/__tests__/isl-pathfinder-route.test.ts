/**
 * Behavioral tests for findBestRoute().
 *
 * Bug history (full-code-review fixes):
 * 1. Fallback paths built 'direct' routes to ground stations with no
 *    line-of-sight check — beams through the Earth with understated latency.
 * 2. The islMandatory hold path kept a previous ISL route with no LoS
 *    re-check on the exit satellite — impossible routes persisted.
 * 3. previousRoute was not invalidated when groundStationsVersion changed —
 *    a held route's groundStationIndex pointed into the reordered array.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { findBestRoute, getRouteLog, resetRouteState } from '../lib/utils/isl-pathfinder';
import { applyStations, type GroundStation } from '../lib/satellites/ground-stations';
import {
  setTLEData,
  setPositionsArray,
  setInclinationsArray,
  setRAANArray,
  setISLCapableArray,
  setDetectedPop,
} from '../lib/satellites/satellite-store';
import { buildISLGraph } from '../lib/satellites/isl-graph';
import { geodeticToCartesian } from '../lib/utils/coordinates';
import type { TLEData } from '../lib/satellites/tle-fetcher';

const SAT_ALT_KM = 550;

function satPosition(latDeg: number, lonDeg: number): { x: number; y: number; z: number } {
  return geodeticToCartesian((latDeg * Math.PI) / 180, (lonDeg * Math.PI) / 180, SAT_ALT_KM, 1);
}

function surfacePosition(latDeg: number, lonDeg: number): { x: number; y: number; z: number } {
  return geodeticToCartesian((latDeg * Math.PI) / 180, (lonDeg * Math.PI) / 180, 0, 1);
}

function gs(name: string, lat: number, lon: number, type: GroundStation['type'] = 'gateway'): GroundStation {
  return { name, lat, lon, status: 'operational', type };
}

/** Install a synthetic satellite catalog into the store. */
function installSats(opts: {
  positions: { x: number; y: number; z: number }[];
  islCapable?: boolean[];
}): void {
  const n = opts.positions.length;
  setTLEData(
    opts.positions.map((_, i) => ({ name: `TEST-${i}`, line1: '', line2: '' })) as unknown as TLEData[],
  );
  const posArr = new Float32Array(n * 3);
  opts.positions.forEach((p, i) => {
    posArr[i * 3] = p.x;
    posArr[i * 3 + 1] = p.y;
    posArr[i * 3 + 2] = p.z;
  });
  setPositionsArray(posArr);
  setInclinationsArray(new Float32Array(n).fill(53));
  setRAANArray(new Float32Array(n).fill(100));
  setISLCapableArray(Uint8Array.from((opts.islCapable ?? Array(n).fill(false)).map((b) => (b ? 1 : 0))));
}

function lastLogAction(): string {
  const log = getRouteLog();
  return log[log.length - 1]?.action ?? 'none';
}

beforeEach(() => {
  setDetectedPop(null);
  // Bumping the version must also clear any held route from a previous test.
  applyStations([]);
});

describe('findBestRoute — line-of-sight enforcement', () => {
  it('returns null instead of a through-the-Earth direct route when no GS is visible', () => {
    // Satellite over the Atlantic; the only gateway is on the opposite side
    // of the planet. The old fallback returned a 'direct' route to it.
    applyStations([gs('Antipode, XX', 0, 180)]);
    installSats({ positions: [satPosition(0, 0)] });
    const dish = surfacePosition(0, 0);

    const route = findBestRoute(0, dish, null);
    expect(route).toBeNull();
  });

  it('returns a direct route to a visible gateway when one exists', () => {
    applyStations([gs('Antipode, XX', 0, 180), gs('Nearby, XX', 5, 5)]);
    installSats({ positions: [satPosition(0, 0)] });
    const dish = surfacePosition(0, 0);

    const route = findBestRoute(0, dish, null);
    expect(route).not.toBeNull();
    expect(route!.type).toBe('direct');
    expect(route!.groundStationIndex).toBe(1);
    expect(Number.isFinite(route!.latencyMs)).toBe(true);
  });

  it('returns null in the PoP-constrained fallback rather than routing through the Earth', () => {
    // PoP-constrained (Frankfurt), no constrained GS visible (sat too far
    // west), satellite not ISL-capable → old code fell back to the nearest
    // unconstrained GS with no LoS check.
    applyStations([
      gs('Frankfurt 1, DE', 50.1, 8.7),
      gs('Frankfurt 2, DE', 49.0, 8.0),
      gs('Frankfurt 3, DE', 51.0, 9.0),
    ]);
    installSats({ positions: [satPosition(50, -60)], islCapable: [false] });
    setDetectedPop('Frankfurt, DE');
    const dish = surfacePosition(50, -60);

    const route = findBestRoute(0, dish, null);
    expect(route).toBeNull();
  });
});

describe('findBestRoute — ISL hold path', () => {
  it('drops a held ISL route once its exit satellite loses line-of-sight', () => {
    // Sat 0 (connected, ISL-capable) cannot see the Frankfurt gateways;
    // sat 1 (in-plane ISL neighbor) can → first call yields an ISL route.
    applyStations([
      gs('Frankfurt 1, DE', 50.1, 8.7),
      gs('Frankfurt 2, DE', 49.0, 8.0),
      gs('Frankfurt 3, DE', 51.0, 9.0),
    ]);
    const positions = [satPosition(50, -32), satPosition(50, -24)];
    installSats({ positions, islCapable: [true, true] });
    expect(buildISLGraph()).not.toBeNull();
    setDetectedPop('Frankfurt, DE');
    const dish = surfacePosition(50, -32);

    const first = findBestRoute(0, dish, null);
    expect(first).not.toBeNull();
    expect(first!.type).toBe('isl');
    expect(first!.satelliteIndices).toEqual([0, 1]);

    // Move the exit satellite (sat 1) to the far side of the planet: it
    // loses LoS to its gateway and can no longer reach any constrained GS.
    const posArr = new Float32Array(2 * 3);
    const moved = [satPosition(50, -32), satPosition(50, 160)];
    moved.forEach((p, i) => {
      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;
    });
    setPositionsArray(posArr);

    // Old code held the now-impossible ISL route indefinitely.
    const second = findBestRoute(0, dish, null);
    expect(second).toBeNull();
    expect(lastLogAction()).not.toBe('hold');
  });
});

describe('findBestRoute — ground station refresh invalidation', () => {
  it('does not hold a route across a groundStationsVersion change', () => {
    applyStations([gs('Nearby, XX', 5, 5)]);
    installSats({ positions: [satPosition(0, 0)] });
    const dish = surfacePosition(0, 0);

    const first = findBestRoute(0, dish, null);
    expect(first).not.toBeNull();
    expect(lastLogAction()).toBe('new');

    // Within the 30s hold window the route is held...
    findBestRoute(0, dish, null);
    expect(lastLogAction()).toBe('hold');

    // ...but a station refresh reorders the array, so the held route's
    // groundStationIndex is meaningless and must be discarded. 'Other' is
    // deliberately visible too: with the bug, the hold survives and silently
    // points at the wrong (but LoS-valid) station.
    applyStations([gs('Other, YY', 6, 6), gs('Nearby, XX', 5, 5)]);
    const after = findBestRoute(0, dish, null);
    expect(lastLogAction()).toBe('new');
    expect(after).not.toBeNull();
    expect(after!.groundStationIndex).toBe(1);
  });
});

describe('resetRouteState', () => {
  it('clears the held route so the next decision is fresh (used on catalog rebuild)', () => {
    applyStations([gs('Nearby, XX', 5, 5)]);
    installSats({ positions: [satPosition(0, 0)] });
    const dish = surfacePosition(0, 0);

    findBestRoute(0, dish, null);
    findBestRoute(0, dish, null);
    expect(lastLogAction()).toBe('hold');

    // After a TLE refresh / altitude-filter toggle the satellite indices in
    // the held route point at different satellites — it must be discarded.
    resetRouteState();
    findBestRoute(0, dish, null);
    expect(lastLogAction()).toBe('new');
  });
});
