/**
 * Convert equatorial coordinates (RA/Dec) to horizontal (Az/El).
 * Uses satellite.js gstime() for GMST computation.
 */
import { gstime } from 'satellite.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Convert RA/Dec (J2000, degrees) to Az/El (degrees) for a given
 * observer location and time.
 *
 * @returns { az, el } where az is 0=N, 90=E and el is degrees above horizon
 */
export function raDecToAzEl(
  raDeg: number,
  decDeg: number,
  date: Date,
  latDeg: number,
  lonDeg: number
): { az: number; el: number } {
  // GMST in radians from satellite.js
  const jd = date.getTime() / 86400000 + 2440587.5;
  const gmstRad = gstime(jd);

  // Local sidereal time
  const lst = gmstRad + lonDeg * DEG_TO_RAD;

  // Hour angle
  const ha = lst - raDeg * DEG_TO_RAD;

  const sinDec = Math.sin(decDeg * DEG_TO_RAD);
  const cosDec = Math.cos(decDeg * DEG_TO_RAD);
  const sinLat = Math.sin(latDeg * DEG_TO_RAD);
  const cosLat = Math.cos(latDeg * DEG_TO_RAD);
  const cosHa = Math.cos(ha);
  const sinHa = Math.sin(ha);

  // Elevation
  const sinEl = sinDec * sinLat + cosDec * cosLat * cosHa;
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl))) * RAD_TO_DEG;

  // Azimuth
  const cosEl = Math.cos(el * DEG_TO_RAD);
  let az: number;
  if (Math.abs(cosEl) < 1e-10) {
    az = 0;
  } else {
    const sinAz = -cosDec * sinHa / cosEl;
    const cosAz = (sinDec - sinLat * sinEl) / (cosLat * cosEl);
    az = Math.atan2(sinAz, cosAz) * RAD_TO_DEG;
    if (az < 0) az += 360;
  }

  return { az, el };
}
