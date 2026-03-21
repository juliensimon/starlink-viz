import { GROUND_STATIONS, refreshGroundStations } from '@/lib/satellites/ground-stations';

let initialized = false;

export async function GET() {
  if (!initialized) {
    await refreshGroundStations();
    initialized = true;
  }

  return Response.json({
    count: GROUND_STATIONS.length,
    stations: GROUND_STATIONS,
  });
}
