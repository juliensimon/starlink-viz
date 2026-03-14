/**
 * Per-gateway backhaul latency estimation.
 *
 * Computes one-way fiber latency from each ground station to the nearest
 * major IXP (Internet Exchange Point), using great-circle distance × 1.4
 * (fiber route factor) at 0.67c (fiber refractive index ~1.47), plus 1ms
 * for router/switch processing.
 *
 * Returns RTT contribution (doubled one-way + processing).
 */

import { GROUND_STATIONS } from '../satellites/ground-stations';
import { EARTH_RADIUS_KM } from '../config';

interface IXP {
  name: string;
  lat: number;
  lon: number;
}

// Major IXPs / data center hubs where Starlink peers
const MAJOR_IXPS: IXP[] = [
  // North America
  { name: 'Ashburn', lat: 39.0438, lon: -77.4874 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Dallas', lat: 32.7767, lon: -96.7970 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918 },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
  // Europe
  { name: 'Frankfurt', lat: 50.1109, lon: 8.6821 },
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Milan', lat: 45.4642, lon: 9.1900 },
  { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
  { name: 'Warsaw', lat: 52.2297, lon: 21.0122 },
  // Asia-Pacific
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Auckland', lat: -36.8485, lon: 174.7633 },
  // South America
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
  { name: 'Santiago', lat: -33.4489, lon: -70.6693 },
  { name: 'Bogota', lat: 4.7110, lon: -74.0721 },
  // Africa / Middle East
  { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
  { name: 'Muscat', lat: 23.5880, lon: 58.3829 },
];

const FIBER_SPEED_KM_S = 299792.458 * 0.67; // ~200,861 km/s
const FIBER_ROUTE_FACTOR = 1.4; // fiber paths aren't great-circle straight
const ROUTER_PROCESSING_MS = 1.0; // per-direction router/switch delay

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine great-circle distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Pre-computed RTT backhaul latency (ms) for each ground station.
 * Index matches GROUND_STATIONS array.
 */
export const GS_BACKHAUL_RTT_MS: number[] = GROUND_STATIONS.map((gs) => {
  let minDist = Infinity;
  for (const ixp of MAJOR_IXPS) {
    const d = haversineKm(gs.lat, gs.lon, ixp.lat, ixp.lon);
    if (d < minDist) minDist = d;
  }

  const fiberKm = minDist * FIBER_ROUTE_FACTOR;
  const oneWayMs = (fiberKm / FIBER_SPEED_KM_S) * 1000 + ROUTER_PROCESSING_MS;
  return oneWayMs * 2; // RTT
});
