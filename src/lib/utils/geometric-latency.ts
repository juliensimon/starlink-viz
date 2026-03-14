import { EARTH_RADIUS_KM, ISL_PROCESSING_DELAY_MS, BASE_PROCESSING_RTT_MS } from '../config';

export const SPEED_OF_LIGHT_KM_S = 299792.458;

/** Compute the speed-of-light one-way distance (km) between two unit-sphere positions */
function distKm(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * EARTH_RADIUS_KM;
}

/**
 * Compute round-trip latency (ms) from dish → satellite → gateway using speed of light.
 * All positions are in the unit-sphere coordinate system (scaled by EARTH_RADIUS_KM).
 */
export function computeGeometricLatency(
  dishPos: { x: number; y: number; z: number },
  satPos: { x: number; y: number; z: number },
  gatewayPos: { x: number; y: number; z: number },
): number {
  const dist1 = distKm(dishPos, satPos);
  const dist2 = distKm(satPos, gatewayPos);

  // Round-trip: dish → sat → gateway → sat → dish
  const rttMs = (dist1 + dist2) * 2 / SPEED_OF_LIGHT_KM_S * 1000;

  return rttMs + BASE_PROCESSING_RTT_MS;
}

/**
 * Compute round-trip latency (ms) for an ISL multi-hop route.
 * Path: dish → sat₀ → (ISL hops) → satN → gateway
 *
 * @param dishPos Dish position (unit-sphere coords)
 * @param satPositions Array of satellite positions along the route (unit-sphere coords)
 * @param gatewayPos Gateway position (unit-sphere coords)
 */
export function computeISLRouteLatency(
  dishPos: { x: number; y: number; z: number },
  satPositions: { x: number; y: number; z: number }[],
  gatewayPos: { x: number; y: number; z: number },
): number {
  if (satPositions.length === 0) return 0;

  // dish → first satellite
  let totalDistKm = distKm(dishPos, satPositions[0]);

  // ISL hops between satellites
  const islHops = satPositions.length - 1;
  for (let i = 0; i < islHops; i++) {
    totalDistKm += distKm(satPositions[i], satPositions[i + 1]);
  }

  // Last satellite → gateway
  totalDistKm += distKm(satPositions[satPositions.length - 1], gatewayPos);

  // Round-trip
  const rttMs = (totalDistKm * 2) / SPEED_OF_LIGHT_KM_S * 1000;

  // ISL OEO processing per hop (RTT) + base end-to-end processing
  return rttMs + (islHops * ISL_PROCESSING_DELAY_MS * 2) + BASE_PROCESSING_RTT_MS;
}
