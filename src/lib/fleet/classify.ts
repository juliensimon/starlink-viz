import { isOperationalAltitude, SHELL_ALT_BANDS } from '@/lib/config';

export type SatelliteStatus =
  | 'operational'
  | 'raising'
  | 'deorbiting'
  | 'decayed'
  | 'anomalous'
  | 'unknown';

export interface ClassifyInput {
  inclination: number;
  altitudeKm: number;
  eccentricity: number;
  epochAgeHours: number;
  altitudeHistory: number[];
  /** Epoch timestamps (seconds) corresponding to altitudeHistory entries, for rate calculation */
  altitudeTimestamps?: number[];
}

export function classifySatelliteStatus(input: ClassifyInput): SatelliteStatus {
  const { inclination, altitudeKm, eccentricity, epochAgeHours, altitudeHistory, altitudeTimestamps } = input;

  // Decayed checks
  if (altitudeKm < 0 || altitudeKm > 2000) {
    return 'decayed';
  }
  if (epochAgeHours > 336 && altitudeKm < 250) {
    return 'decayed';
  }

  // Anomalous
  if (eccentricity > 0.005) {
    return 'anomalous';
  }

  // Operational
  if (isOperationalAltitude(inclination, altitudeKm)) {
    return 'operational';
  }

  // Need at least 3 history points for raising/deorbiting
  if (altitudeHistory.length < 3) {
    return 'unknown';
  }

  // Get the 3 most recent altitudes
  const recent = altitudeHistory.slice(-3);

  // Find the shell's minAlt
  let minAlt = 460; // fallback
  for (const band of SHELL_ALT_BANDS) {
    if (inclination >= band.minInc && inclination < band.maxInc) {
      minAlt = band.minAlt;
      break;
    }
  }

  const belowMinAlt = altitudeKm < minAlt;
  const belowBy20 = altitudeKm < minAlt - 20;

  const allIncreasing = recent[2] > recent[1] && recent[1] > recent[0];
  const allDecreasing = recent[2] < recent[1] && recent[1] < recent[0];

  // Raising: below minAlt by >20km AND all 3 recent altitudes increasing
  if (belowBy20 && allIncreasing) {
    return 'raising';
  }

  // Deorbiting: below minAlt AND all 3 recent altitudes decreasing AND rate > 1 km/day
  if (belowMinAlt && allDecreasing) {
    const totalDrop = recent[0] - recent[2]; // positive value = drop
    let rateKmPerDay = totalDrop; // default assumption

    if (altitudeTimestamps && altitudeTimestamps.length >= 3) {
      const recentTs = altitudeTimestamps.slice(-3);
      const spanSeconds = recentTs[2] - recentTs[0];
      if (spanSeconds > 0) {
        const spanDays = spanSeconds / 86400;
        rateKmPerDay = totalDrop / spanDays;
      }
    }

    if (rateKmPerDay > 1) {
      return 'deorbiting';
    }
  }

  return 'unknown';
}

export function getShellId(inclination: number): number {
  for (let i = 0; i < SHELL_ALT_BANDS.length; i++) {
    const band = SHELL_ALT_BANDS[i];
    if (inclination >= band.minInc && inclination < band.maxInc) {
      return i;
    }
  }
  return 2; // fallback to 53° shell
}
