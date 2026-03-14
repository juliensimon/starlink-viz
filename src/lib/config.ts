/**
 * Shared dish configuration.
 * Single source of truth for dish location and antenna parameters.
 */

export const DISH_LAT_DEG = parseFloat(process.env.NEXT_PUBLIC_DISH_LAT ?? '48.910');
export const DISH_LON_DEG = parseFloat(process.env.NEXT_PUBLIC_DISH_LON ?? '1.910');

/** Max electronic beam steering angle from boresight (degrees) */
export const MAX_STEERING_DEG = 25;

/** Minimum satellite elevation for tracking (degrees) */
export const MIN_ELEVATION_DEG = 25;

/** Earth mean radius in km */
export const EARTH_RADIUS_KM = 6371;

/** Operational altitude band (km) — satellites outside this are orbit-raising or deorbiting */
export const MIN_OPERATIONAL_ALT_KM = 460;
export const MAX_OPERATIONAL_ALT_KM = 910;

/**
 * Per-shell operational altitude bands (km).
 *
 * Gen1 (Phase 1) — 5 shells, ~4,408 sats:
 *   53.0° at 550 km (1,584), 53.2° at 540 km (1,584),
 *   70.0° at 570 km (720), 97.6° at 560 km (520)
 *
 * Gen2 (FCC 22-91, Dec 2022) — 3 shells, 7,500 sats authorized:
 *   53° at 525 km, 43° at 530 km, 33° at 535 km (not yet launched)
 *
 * Gen2 Upgrade (FCC DA 26-36, Jan 2026) — VLEO 340–485 km (not yet populated)
 *
 * Sources: FCC 22-91, FCC DA 26-36, Jonathan McDowell tracking data
 */
/**
 * Bands derived from SGP4-propagated instantaneous altitudes (March 2026).
 *
 * IMPORTANT: Mean-motion-derived altitudes differ significantly from SGP4
 * instantaneous altitudes due to orbital decay and drag modeling. These
 * bands use SGP4 output (what the app actually computes).
 *
 * SGP4-observed clusters (53° shell as example):
 *   480-490 km: ~2,400 sats (Gen1 lowered to new altitude)
 *   540-560 km: ~1,400 sats (Gen1 at original altitude)
 *   310-440 km: ~650 sats (orbit-raising or deorbiting)
 */
export const SHELL_ALT_BANDS: { minInc: number; maxInc: number; minAlt: number; maxAlt: number }[] = [
  { minInc: 0,  maxInc: 38, minAlt: 460, maxAlt: 570 },  // 33° — not yet launched, wide band for when it is
  { minInc: 38, maxInc: 48, minAlt: 460, maxAlt: 570 },  // 43° — similar profile to 53°
  { minInc: 48, maxInc: 60, minAlt: 460, maxAlt: 570 },  // 53° — Gen1 at 480-490 + 540-560 km
  { minInc: 60, maxInc: 80, minAlt: 460, maxAlt: 910 },  // 70° — wide range, some at ~880-900 km
  { minInc: 80, maxInc: 180, minAlt: 460, maxAlt: 600 }, // 97.6° — observed 550-590 km
];

/** Check if a satellite is at operational altitude for its shell */
export function isOperationalAltitude(inclination: number, altitudeKm: number): boolean {
  for (const band of SHELL_ALT_BANDS) {
    if (inclination >= band.minInc && inclination < band.maxInc) {
      return altitudeKm >= band.minAlt && altitudeKm <= band.maxAlt;
    }
  }
  // Fallback: use global band
  return altitudeKm >= MIN_OPERATIONAL_ALT_KM && altitudeKm <= MAX_OPERATIONAL_ALT_KM;
}
