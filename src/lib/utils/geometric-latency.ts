import { EARTH_RADIUS_KM } from '../config';

const SPEED_OF_LIGHT_KM_S = 299792.458;

/**
 * Compute round-trip latency (ms) from dish → satellite → gateway using speed of light.
 * All positions are in the unit-sphere coordinate system (scaled by EARTH_RADIUS_KM).
 */
export function computeGeometricLatency(
  dishPos: { x: number; y: number; z: number },
  satPos: { x: number; y: number; z: number },
  gatewayPos: { x: number; y: number; z: number },
): number {
  const dx1 = satPos.x - dishPos.x;
  const dy1 = satPos.y - dishPos.y;
  const dz1 = satPos.z - dishPos.z;
  const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1) * EARTH_RADIUS_KM;

  const dx2 = gatewayPos.x - satPos.x;
  const dy2 = gatewayPos.y - satPos.y;
  const dz2 = gatewayPos.z - satPos.z;
  const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2) * EARTH_RADIUS_KM;

  // Round-trip: dish → sat → gateway → sat → dish
  const rttMs = (dist1 + dist2) * 2 / SPEED_OF_LIGHT_KM_S * 1000;

  // Processing and backhaul jitter estimate
  return rttMs + 3 + Math.random() * 4;
}
