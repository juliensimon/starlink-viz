/**
 * Known Starlink ground station locations worldwide.
 */

export interface GroundStation {
  name: string;
  lat: number;
  lon: number;
}

export const GROUND_STATIONS: GroundStation[] = [
  { name: 'Hawthorne, CA', lat: 33.9207, lon: -118.328 },
  { name: 'Redmond, WA', lat: 47.674, lon: -122.1215 },
  { name: 'Merrillan, WI', lat: 44.45, lon: -90.8333 },
  { name: 'North Bend, OR', lat: 43.4073, lon: -124.2242 },
  { name: 'Conrad, MT', lat: 48.1697, lon: -111.945 },
  { name: 'Boca Chica, TX', lat: 26.0621, lon: -97.1668 },
  { name: 'Lockport, NY', lat: 43.1709, lon: -78.6903 },
  { name: 'Gravelly Point, FL', lat: 28.6085, lon: -80.6045 },
  { name: 'Manassas, VA', lat: 38.7509, lon: -77.4753 },
  { name: 'Cobourg, ON', lat: 43.9595, lon: -78.168 },
  { name: "Villenave-d'Ornon, France", lat: 44.76, lon: -0.5544 },
  { name: 'Gravelines, France', lat: 50.9863, lon: 2.1281 },
  { name: 'Warkworth, NZ', lat: -36.4344, lon: 174.6631 },
  { name: 'Rollesbroich, Germany', lat: 50.6262, lon: 6.2978 },
  { name: 'Pune, India', lat: 18.5204, lon: 73.8567 },
  { name: 'Bogota, Colombia', lat: 4.711, lon: -74.0721 },
  { name: 'Santiago, Chile', lat: -33.4489, lon: -70.6693 },
  { name: 'Sydney, Australia', lat: -33.8688, lon: 151.2093 },
  { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503 },
];

/**
 * Find the nearest ground station to a given lat/lon (in degrees).
 */
export function findNearestGroundStation(lat: number, lon: number): GroundStation {
  let nearest = GROUND_STATIONS[0];
  let minDist = Infinity;

  for (const gs of GROUND_STATIONS) {
    const dLat = gs.lat - lat;
    const dLon = gs.lon - lon;
    // Simple squared distance (good enough for nearest search)
    const dist = dLat * dLat + dLon * dLon;
    if (dist < minDist) {
      minDist = dist;
      nearest = gs;
    }
  }

  return nearest;
}
