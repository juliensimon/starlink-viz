/**
 * Shared response cache for the TLE API routes (/api/tle, /api/tle-gps).
 * 6h in-memory cache, long-lived Cache-Control on hits, stale-on-error
 * with a short max-age, 502 when nothing is available.
 */
import type { TLEData } from './tle-fetcher';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const FRESH_HEADERS = { 'Cache-Control': 'public, max-age=21600, s-maxage=21600' };
const STALE_HEADERS = { 'Cache-Control': 'public, max-age=300' };

export function createCachedTleHandler(
  fetcher: () => Promise<TLEData[]>,
): () => Promise<Response> {
  let cachedData: TLEData[] | null = null;
  let cacheTimestamp = 0;

  return async () => {
    const now = Date.now();

    if (cachedData && now - cacheTimestamp < SIX_HOURS_MS) {
      return Response.json(cachedData, { headers: FRESH_HEADERS });
    }

    try {
      const data = await fetcher();
      cachedData = data;
      cacheTimestamp = now;
      return Response.json(data, { headers: FRESH_HEADERS });
    } catch (error) {
      // Serve stale data on upstream failure rather than nothing
      if (cachedData) {
        return Response.json(cachedData, { headers: STALE_HEADERS });
      }
      return Response.json(
        { error: 'Failed to fetch TLE data', details: String(error) },
        { status: 502 },
      );
    }
  };
}
