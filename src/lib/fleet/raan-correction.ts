/** J2 zonal harmonic coefficient */
const J2 = 1.08263e-3;

/** Earth mean radius in km */
const R_EARTH_KM = 6371;

/** Earth gravitational parameter in km^3/s^2 */
const MU_EARTH = 398600.4418;

export interface RAANCorrectionInput {
  /** Current RAAN in degrees */
  raanDeg: number;
  /** Orbital inclination in degrees */
  inclination: number;
  /** Mean motion in rev/day */
  meanMotion: number;
  /** Time difference in seconds (positive = forward in time) */
  deltaSeconds: number;
}

/**
 * Corrects RAAN to a common reference epoch using J2 precession.
 * Returns RAAN in degrees, wrapped to [0, 360).
 */
export function correctRAANToEpoch(input: RAANCorrectionInput): number {
  const { raanDeg, inclination, meanMotion, deltaSeconds } = input;

  if (deltaSeconds === 0) return raanDeg;

  // Convert mean motion from rev/day to rad/s
  const nRadSec = (meanMotion * 2 * Math.PI) / 86400;

  // Semi-major axis from mean motion: a = (mu / n^2)^(1/3)
  const a = Math.pow(MU_EARTH / (nRadSec * nRadSec), 1 / 3);

  // J2 precession rate (rad/s)
  const cosInc = Math.cos((inclination * Math.PI) / 180);
  const ratio = R_EARTH_KM / a;
  const dOmegaDt = -1.5 * nRadSec * J2 * ratio * ratio * cosInc;

  // Apply correction over deltaSeconds
  const dOmegaRad = dOmegaDt * deltaSeconds;
  const dOmegaDeg = (dOmegaRad * 180) / Math.PI;

  // Wrap to [0, 360)
  let corrected = (raanDeg + dOmegaDeg) % 360;
  if (corrected < 0) corrected += 360;

  return corrected;
}
