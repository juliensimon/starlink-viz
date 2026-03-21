/**
 * Starlink ground station (gateway) locations.
 * Sole source: HF dataset juliensimon/starlink-ground-stations
 *
 * GROUND_STATIONS starts empty and is populated by refreshGroundStations()
 * at startup. All consumers use the same mutable array reference.
 * groundStationsVersion increments on each refresh so derived caches
 * (backhaul RTT, ISL pathfinder, 3D positions) can detect staleness.
 */

export interface GroundStation {
  name: string;
  lat: number;
  lon: number;
  /** operational = confirmed active; planned = approved/under construction */
  status?: 'operational' | 'planned';
  /** gateway = ground station with antennas; pop = internet point of presence / data center */
  type?: 'gateway' | 'pop';
}

/** Mutable array — empty until refreshGroundStations() populates it. */
export const GROUND_STATIONS: GroundStation[] = [];

/** Incremented each time GROUND_STATIONS is refreshed. Consumers
 *  that cache derived data (e.g. gsPositions) should watch this. */
export let groundStationsVersion = 0;

/**
 * Fetch ground station data and populate GROUND_STATIONS in-place.
 * - Server: fetches directly from HF dataset API
 * - Client: fetches from /api/ground-stations (which returns server's data)
 */
export async function refreshGroundStations(): Promise<void> {
  try {
    let stations: GroundStation[];

    if (typeof window === 'undefined') {
      // Server — fetch from HF directly
      const { fetchHFGateways } = await import('./hf-ground-stations');
      stations = await fetchHFGateways();
    } else {
      // Client — fetch from our API (server already has HF data)
      const res = await fetch('/api/ground-stations');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      stations = data.stations;
    }

    if (!stations || stations.length === 0) {
      console.warn('[GS] Received 0 stations');
      return;
    }

    GROUND_STATIONS.length = 0;
    GROUND_STATIONS.push(...stations);
    groundStationsVersion++;
    console.log(`[GS] Ground stations loaded: ${stations.length} (v${groundStationsVersion})`);

    // Recompute backhaul RTT with new station list (server-side only)
    if (typeof window === 'undefined') {
      const { recomputeBackhaulRTT } = await import('../utils/backhaul-latency');
      recomputeBackhaulRTT();
    }
  } catch (err) {
    console.warn('[GS] Failed to load ground stations:', err);
  }
}

/**
 * Find the nearest ground station to a given lat/lon (in degrees).
 * Uses cosine-corrected longitude distance for accuracy at high latitudes.
 */
export function findNearestGroundStation(lat: number, lon: number): GroundStation {
  let nearest = GROUND_STATIONS[0];
  let minDist = Infinity;

  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (const gs of GROUND_STATIONS) {
    const dLat = gs.lat - lat;
    const dLon = (gs.lon - lon) * cosLat;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < minDist) {
      minDist = dist;
      nearest = gs;
    }
  }

  return nearest;
}
