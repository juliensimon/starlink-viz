/**
 * Coordinate conversion utilities for globe/satellite positioning.
 * Globe uses a unit sphere (radius = 1).
 */

import { EARTH_RADIUS_KM } from '../config';

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
  const radius = globeRadius + alt / 6371;
  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  // Negate z to match Three.js SphereGeometry UV mapping (east-positive texture convention)
  const z = -radius * Math.cos(lat) * Math.sin(lon);
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

/**
 * Smallest absolute difference between two angles in degrees, accounting
 * for wraparound (359° and 1° are 2° apart, not 358°). Result in [0, 180].
 */
export function angularDeltaDeg(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

/** Haversine great-circle distance in km between two lat/lon points (degrees). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
