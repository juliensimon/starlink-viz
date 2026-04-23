import { GROUND_STATIONS, refreshGroundStations } from '@/lib/satellites/ground-stations';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
let lastRefreshedAt = 0;

async function refreshIfNeeded() {
  if (Date.now() - lastRefreshedAt > MAX_AGE_MS) {
    await refreshGroundStations();
    lastRefreshedAt = Date.now();
  }
}

export async function GET() {
  await refreshIfNeeded();
  return Response.json({
    count: GROUND_STATIONS.length,
    stations: GROUND_STATIONS,
  });
}

export async function POST() {
  await refreshGroundStations();
  lastRefreshedAt = Date.now();
  return Response.json({
    count: GROUND_STATIONS.length,
    stations: GROUND_STATIONS,
  });
}
