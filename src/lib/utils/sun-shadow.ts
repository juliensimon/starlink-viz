/**
 * Earth shadow model for satellite visibility.
 * Uses a cylindrical shadow approximation (accurate for LEO).
 */

/** Check if the sun is below the observer's horizon. */
export function isSunBelowHorizon(
  normalX: number, normalY: number, normalZ: number,
  sunDirX: number, sunDirY: number, sunDirZ: number
): boolean {
  return sunDirX * normalX + sunDirY * normalY + sunDirZ * normalZ < 0;
}

/**
 * Cylindrical shadow test: is a satellite sunlit?
 * Coordinates are in scene units where Earth is a unit sphere.
 */
export function isSatelliteSunlit(
  satX: number, satY: number, satZ: number,
  sunDirX: number, sunDirY: number, sunDirZ: number
): boolean {
  // Project satellite position onto sun direction
  const dot = satX * sunDirX + satY * sunDirY + satZ * sunDirZ;

  // Sun-side of Earth: always sunlit
  if (dot > 0) return true;

  // Night side: check perpendicular distance to shadow axis
  const perpX = satX - dot * sunDirX;
  const perpY = satY - dot * sunDirY;
  const perpZ = satZ - dot * sunDirZ;
  const perpDistSq = perpX * perpX + perpY * perpY + perpZ * perpZ;

  // Outside the unit sphere shadow cylinder
  return perpDistSq > 1.0;
}
