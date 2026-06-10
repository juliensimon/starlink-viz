/**
 * Shared 6h-cache + stale-on-error behavior for the TLE API routes.
 *
 * Cleanup history: /api/tle and /api/tle-gps each hand-rolled this pattern
 * and had already drifted — the GPS route sent no Cache-Control headers.
 */
import { describe, it, expect, vi } from 'vitest';
import { createCachedTleHandler } from '../lib/satellites/tle-route-cache';
import type { TLEData } from '../lib/satellites/tle-fetcher';

const SAMPLE: TLEData[] = [{ name: 'STARLINK-1007', line1: '1 ...', line2: '2 ...' } as TLEData];

describe('createCachedTleHandler', () => {
  it('serves fetched data with long-lived cache headers', async () => {
    const handler = createCachedTleHandler(async () => SAMPLE);
    const res = await handler();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=21600');
    expect(await res.json()).toEqual(SAMPLE);
  });

  it('only invokes the fetcher once within the cache window', async () => {
    const fetcher = vi.fn(async () => SAMPLE);
    const handler = createCachedTleHandler(fetcher);
    await handler();
    await handler();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves stale data with a short max-age when the fetcher fails', async () => {
    let fail = false;
    const handler = createCachedTleHandler(async () => {
      if (fail) throw new Error('upstream down');
      return SAMPLE;
    });
    await handler();
    fail = true;
    // Force re-fetch by making the cache look expired
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 7 * 60 * 60 * 1000);
    const res = await handler();
    vi.restoreAllMocks();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
    expect(await res.json()).toEqual(SAMPLE);
  });

  it('returns 502 when the fetcher fails and no cache exists', async () => {
    const handler = createCachedTleHandler(async () => {
      throw new Error('upstream down');
    });
    const res = await handler();
    expect(res.status).toBe(502);
  });
});
