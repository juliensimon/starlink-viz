import { fetchTLEData, type TLEData } from '@/lib/satellites/tle-fetcher';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let cachedData: TLEData[] | null = null;
let cacheTimestamp = 0;

export async function GET() {
  const now = Date.now();

  if (cachedData && now - cacheTimestamp < SIX_HOURS_MS) {
    return Response.json(cachedData, {
      headers: {
        'Cache-Control': 'public, max-age=21600, s-maxage=21600',
      },
    });
  }

  try {
    const data = await fetchTLEData();
    cachedData = data;
    cacheTimestamp = now;

    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=21600, s-maxage=21600',
      },
    });
  } catch (error) {
    // If we have stale cached data, return it on error
    if (cachedData) {
      return Response.json(cachedData, {
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    return Response.json(
      { error: 'Failed to fetch TLE data', details: String(error) },
      { status: 502 }
    );
  }
}
