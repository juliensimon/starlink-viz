import { GROUND_STATIONS } from '@/lib/satellites/ground-stations';
import { fetchHFGateways, fetchHFPops, type HFPop } from '@/lib/satellites/hf-ground-stations';
import type { GroundStation } from '@/lib/satellites/ground-stations';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let cachedStations: GroundStation[] | null = null;
let cachedPops: HFPop[] | null = null;
let cacheTimestamp = 0;

export async function GET() {
  const now = Date.now();

  // Return cached data if fresh
  if (cachedStations && cachedPops && now - cacheTimestamp < SIX_HOURS_MS) {
    return Response.json(
      { count: cachedStations.length, stations: cachedStations, pops: cachedPops },
      { headers: { 'Cache-Control': 'public, max-age=21600, s-maxage=21600' } },
    );
  }

  try {
    const [stations, pops] = await Promise.all([fetchHFGateways(), fetchHFPops()]);
    cachedStations = stations;
    cachedPops = pops;
    cacheTimestamp = now;

    return Response.json(
      { count: stations.length, stations, pops },
      { headers: { 'Cache-Control': 'public, max-age=21600, s-maxage=21600' } },
    );
  } catch {
    // Stale cache fallback
    if (cachedStations && cachedPops) {
      return Response.json(
        { count: cachedStations.length, stations: cachedStations, pops: cachedPops },
        { headers: { 'Cache-Control': 'public, max-age=300' } },
      );
    }

    // Last resort: return in-memory GROUND_STATIONS (fallback data)
    return Response.json(
      { count: GROUND_STATIONS.length, stations: GROUND_STATIONS, pops: [] },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  }
}
