/**
 * Coordinate conversion utilities for globe/satellite positioning.
 * Globe uses a unit sphere (radius = 1).
 */

/**
 * Convert geodetic coordinates (lat/lon/alt) to 3D cartesian on the globe.
 * @param lat Latitude in radians
 * @param lon Longitude in radians
 * @param alt Altitude in km
 * @param globeRadius Base globe radius (default 1)
 * @returns {x, y, z} cartesian coordinates
 */
export function geodeticToCartesian(
  lat: number,
  lon: number,
  alt: number,
  globeRadius: number = 1
): { x: number; y: number; z: number } {
  // Compressed scale so satellites aren't too far from globe
  const radius = globeRadius + (alt / 6371) * 0.15;
  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon);
  return { x, y, z };
}

/**
 * Wraps satellite.js ECI-to-geodetic conversion.
 * @param positionEci ECI position vector {x, y, z} in km
 * @param gmst Greenwich Mean Sidereal Time
 * @returns Geodetic position {latitude (rad), longitude (rad), height (km)}
 */
export function eciToGeodetic(
  positionEci: { x: number; y: number; z: number },
  gmst: number
): { latitude: number; longitude: number; height: number } {
  // Re-export satellite.js eciToGeodetic in a simpler form
  // This is used by the propagator which imports satellite.js directly
  const { atan2, sqrt, PI } = Math;

  const a = 6378.137; // Earth semi-major axis km
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;

  const { x, y, z } = positionEci;

  const theta = atan2(y, x) - gmst;
  let longitude = theta;
  while (longitude < -PI) longitude += 2 * PI;
  while (longitude > PI) longitude -= 2 * PI;

  const r = sqrt(x * x + y * y);
  let latitude = atan2(z, r);

  // Iterative latitude refinement
  for (let i = 0; i < 5; i++) {
    const sinLat = Math.sin(latitude);
    const N = a / sqrt(1 - e2 * sinLat * sinLat);
    latitude = atan2(z + e2 * N * sinLat, r);
  }

  const sinLat = Math.sin(latitude);
  const N = a / sqrt(1 - e2 * sinLat * sinLat);
  const height = r / Math.cos(latitude) - N;

  return { latitude, longitude, height };
}
