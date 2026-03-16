/** Shape of a CelesTrak OMM JSON record */
export interface OmmRecord {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  OBJECT_ID: string;
  TLE_LINE1?: string;
  TLE_LINE2?: string;
}

/** Returns true if the name matches the STARLINK-\d+ pattern (excludes Starshield, debris, etc.) */
export function filterStarlinkName(name: string): boolean {
  return /^STARLINK-\d+$/.test(name);
}

/**
 * Parse launch year and launch number from an international designator (COSPAR ID).
 * 2-digit year: >=57 → 1900+yy, else 2000+yy.
 * Launch number is characters 2-5 parsed as integer.
 */
export function parseLaunchInfo(intlDesig: string): { year: number; launch: number } {
  const yy = parseInt(intlDesig.substring(0, 2), 10);
  const year = yy >= 57 ? 1900 + yy : 2000 + yy;
  const launch = parseInt(intlDesig.substring(2, 5), 10);
  return { year, launch };
}

const EARTH_MU = 398600.4418; // km³/s²
const EARTH_RADIUS_KM = 6371;

/**
 * Compute altitude from mean motion (rev/day) and eccentricity.
 * Uses Kepler's third law: a = (μ / n²)^(1/3), altitude = a*(1-e) - R_earth (perigee altitude).
 * For near-circular orbits (Starlink e < 0.001), this is effectively the orbital altitude.
 */
export function altitudeFromMeanMotion(meanMotionRevPerDay: number, eccentricity: number): number {
  const n = (meanMotionRevPerDay * 2 * Math.PI) / 86400; // rad/s
  const a = Math.pow(EARTH_MU / (n * n), 1 / 3); // semi-major axis in km
  // Use mean altitude: a - R_earth (for near-circular orbits, perigee and apogee are ~equal)
  const altKm = a * (1 - eccentricity) - EARTH_RADIUS_KM;
  return altKm;
}

/**
 * Compute epoch as fractional day-of-year (TLE-style epoch value).
 * Format: YYDDD.DDDDDDDD where YY=2-digit year, DDD=day of year.
 */
export function computeEpochValue(epochStr: string): number {
  const d = new Date(epochStr);
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const dayOfYear =
    (d.getTime() - startOfYear.getTime()) / 86400000 + 1; // 1-based
  const yy = year % 100;
  return yy * 1000 + dayOfYear;
}
