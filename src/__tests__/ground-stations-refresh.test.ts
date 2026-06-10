/**
 * Regression tests for the HF ground-station refresh path.
 *
 * Bug history: after the HF migration, GS_BACKHAUL_RTT_MS was computed once
 * at module load (from an empty GROUND_STATIONS) and only recomputed
 * server-side, so every client-side route latency became NaN
 * (number + undefined). Separately, a failed HF refresh was recorded as
 * successful, disabling routing for 24h.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GROUND_STATIONS,
  groundStationsVersion,
  applyStations,
  refreshGroundStations,
} from '../lib/satellites/ground-stations';
import { getBackhaulRTT } from '../lib/utils/backhaul-latency';
import { GET } from '../app/api/ground-stations/route';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** Minimal HF datasets-server payload for one gateway + one pop. */
function fakeHFResponse(url: string): Response {
  const isPops = url.includes('config=pops');
  const body = isPops
    ? {
        rows: [{ row: { code: 'PAR', city: 'Paris, FR', country: 'FR', lat: 48.85, lon: 2.35 } }],
        num_rows_total: 1,
      }
    : {
        rows: [
          { row: { name: 'Villenave, FR', lat: 44.77, lon: -0.55, status: 'operational', type: 'gateway' } },
        ],
        num_rows_total: 1,
      };
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('applyStations', () => {
  it('replaces GROUND_STATIONS in place and bumps the version counter', () => {
    const versionBefore = groundStationsVersion;
    applyStations([{ name: 'A', lat: 1, lon: 2, status: 'operational', type: 'gateway' }]);
    expect(GROUND_STATIONS.length).toBe(1);
    expect(GROUND_STATIONS[0].name).toBe('A');

    applyStations([
      { name: 'B', lat: 3, lon: 4, status: 'operational', type: 'gateway' },
      { name: 'C', lat: 5, lon: 6, status: 'operational', type: 'pop' },
    ]);
    expect(GROUND_STATIONS.length).toBe(2);
    expect(groundStationsVersion).toBe(versionBefore + 2);
  });
});

describe('getBackhaulRTT', () => {
  it('tracks ground-station refreshes without a manual recompute call', () => {
    // Regression: previously the RTT array was computed once at module load
    // (empty) and never rebuilt on the client → latency = x + undefined = NaN.
    applyStations([{ name: 'Near Chicago', lat: 41.9, lon: -87.6, status: 'operational', type: 'gateway' }]);
    const rtt1 = getBackhaulRTT();
    expect(rtt1.length).toBe(1);
    expect(rtt1[0]).toBeGreaterThan(0);
    expect(Number.isFinite(rtt1[0])).toBe(true);

    applyStations([
      { name: 'Near Chicago', lat: 41.9, lon: -87.6, status: 'operational', type: 'gateway' },
      { name: 'Punta Arenas, Chile', lat: -53.16, lon: -70.9, status: 'operational', type: 'gateway' },
    ]);
    const rtt2 = getBackhaulRTT();
    expect(rtt2.length).toBe(2);
    expect(rtt2.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
  });
});

describe('refreshGroundStations', () => {
  it('returns false when the HF fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as typeof fetch;
    const ok = await refreshGroundStations();
    expect(ok).toBe(false);
  });

  it('returns true and populates stations on success', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => fakeHFResponse(String(input))) as typeof fetch;
    const ok = await refreshGroundStations();
    expect(ok).toBe(true);
    expect(GROUND_STATIONS.length).toBe(2); // 1 gateway + 1 pop
  });
});

describe('GET /api/ground-stations', () => {
  it('retries the refresh on the next request after a failure instead of caching it for 24h', async () => {
    // First request: HF is down → refresh fails → 0 stations served.
    applyStations([]);
    globalThis.fetch = vi.fn(async () => {
      throw new Error('HF down');
    }) as typeof fetch;
    const res1 = await GET();
    const data1 = await res1.json();
    expect(data1.count).toBe(0);

    // HF recovers → the very next GET must retry, not wait 24h.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => fakeHFResponse(String(input))) as typeof fetch;
    const res2 = await GET();
    const data2 = await res2.json();
    expect(data2.count).toBe(2);
  });
});
