import * as THREE from 'three';

const DEG_TO_RAD = Math.PI / 180;
const AXIAL_TILT = 23.44 * DEG_TO_RAD;

/**
 * Compute the Sun's direction vector in the scene's coordinate system.
 * Uses a simplified ecliptic longitude model based on day-of-year and time-of-day.
 */
export function getSunDirection(date: Date): THREE.Vector3 {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Ecliptic longitude (simple approximation — perihelion offset)
  const sunLon = (2 * Math.PI * (dayOfYear - 80)) / 365;

  // Sun direction in ecliptic coordinates (tilted by axial tilt)
  const x = Math.cos(sunLon);
  const y = Math.sin(sunLon) * Math.sin(AXIAL_TILT);
  const z = -Math.sin(sunLon) * Math.cos(AXIAL_TILT);

  // Rotate by Earth's rotation angle (time of day) around Y axis
  const hours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  // +π because at UTC noon the sub-solar point is near lon=0° (+X in scene coords)
  const earthRotation = (hours / 24) * 2 * Math.PI + Math.PI;

  const cosR = Math.cos(earthRotation);
  const sinR = Math.sin(earthRotation);

  return new THREE.Vector3(
    x * cosR + z * sinR,
    y,
    -x * sinR + z * cosR
  ).normalize();
}

/**
 * Compute the Moon's direction vector in the scene's coordinate system.
 * Simplified lunar position using mean orbital elements.
 *
 * Lunar orbital parameters:
 * - Sidereal period: ~27.3217 days
 * - Orbital inclination to ecliptic: ~5.14°
 * - Ascending node precession: ~18.6 years (6793.5 days)
 */
export function getMoonDirection(date: Date): THREE.Vector3 {
  // J2000.0 epoch
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const daysSinceJ2000 = (date.getTime() - J2000) / (1000 * 60 * 60 * 24);

  // Mean lunar longitude (degrees from vernal equinox)
  const L = (218.316 + 13.176396 * daysSinceJ2000) % 360;
  // Mean anomaly
  const M = (134.963 + 13.064993 * daysSinceJ2000) % 360;
  // Mean distance (ascending node longitude)
  const F = (93.272 + 13.229350 * daysSinceJ2000) % 360;

  const Lrad = L * DEG_TO_RAD;
  const Mrad = M * DEG_TO_RAD;
  const Frad = F * DEG_TO_RAD;

  // Ecliptic longitude with principal perturbation terms
  const eclLon =
    Lrad +
    6.289 * DEG_TO_RAD * Math.sin(Mrad) +
    1.274 * DEG_TO_RAD * Math.sin(2 * Lrad - Mrad) +
    0.658 * DEG_TO_RAD * Math.sin(2 * Lrad);

  // Ecliptic latitude
  const eclLat = 5.128 * DEG_TO_RAD * Math.sin(Frad);

  // Convert ecliptic to equatorial-ish coordinates
  // Apply Earth's axial tilt
  const cosLon = Math.cos(eclLon);
  const sinLon = Math.sin(eclLon);
  const cosLat = Math.cos(eclLat);
  const sinLat = Math.sin(eclLat);

  // In ecliptic cartesian
  const xe = cosLat * cosLon;
  const ye = cosLat * sinLon;
  const ze = sinLat;

  // Rotate by obliquity (ecliptic -> equatorial)
  const cosObl = Math.cos(AXIAL_TILT);
  const sinObl = Math.sin(AXIAL_TILT);
  const xeq = xe;
  const yeq = ye * cosObl - ze * sinObl;
  const zeq = ye * sinObl + ze * cosObl;

  // Rotate by Earth's rotation (sidereal time)
  const hours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const gmst = (280.46061837 + 360.98564736629 * daysSinceJ2000 + hours * 15) % 360;
  const gmstRad = gmst * DEG_TO_RAD;

  const cosG = Math.cos(gmstRad);
  const sinG = Math.sin(gmstRad);

  // Scene coordinate system: X = cos(lat)cos(lon), Y = sin(lat), Z = -cos(lat)sin(lon)
  return new THREE.Vector3(
    xeq * cosG + zeq * sinG,
    yeq,
    -xeq * sinG + zeq * cosG
  ).normalize();
}
