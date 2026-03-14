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
export const MIN_OPERATIONAL_ALT_KM = 470;
export const MAX_OPERATIONAL_ALT_KM = 580;

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
export const SHELL_ALT_BANDS: { minInc: number; maxInc: number; minAlt: number; maxAlt: number }[] = [
  { minInc: 0,  maxInc: 38, minAlt: 525, maxAlt: 545 },  // 33° — Gen2-C target 535 km (not yet launched)
  { minInc: 38, maxInc: 48, minAlt: 520, maxAlt: 540 },  // 43° — Gen2-B target 530 km
  { minInc: 48, maxInc: 60, minAlt: 470, maxAlt: 560 },  // 53° — Gen1 lowering to ~480 km + Gen1 at 540-550 km + Gen2 at 525 km
  { minInc: 60, maxInc: 80, minAlt: 560, maxAlt: 580 },  // 70° — Gen1 at 570 km
  { minInc: 80, maxInc: 180, minAlt: 550, maxAlt: 570 }, // 97.6° — Gen1 at 560 km
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
