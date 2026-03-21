/**
 * ISL (Inter-Satellite Laser Link) capability detection.
 *
 * Heuristic based on TLE-available data (launch year + inclination):
 * - All shells: ISL-capable only if launched after laser terminals were added
 * - Polar shells (inc >= 60°): ISL from 2022+ (first polar batch in 2021 was v1.0 without lasers)
 * - 53° shell (48-60°): ISL from 2022+ (v1.5 lasers added ~Sep 2021, first full ISL batch launched Jan 2022)
 * - 43° shell (38-48°): ISL from 2023+ (all v2 Mini have 4 laser terminals)
 * - 33° shell (< 38°): ISL from 2024+ (not yet launched, will have ISL)
 */

/** Determine if a satellite is ISL-capable based on inclination and launch year */
export function isISLCapable(inclination: number, launchYear: number): boolean {
  if (inclination >= 60) return launchYear >= 2022; // Polar shells: ISL from 2022+
  if (inclination >= 48) return launchYear >= 2022; // 53° shell
  if (inclination >= 38) return launchYear >= 2023; // 43° shell
  return launchYear >= 2024;                  // 33° shell
}

/**
 * Parse RAAN (Right Ascension of Ascending Node) from TLE line 2.
 * Columns 17-25 contain the RAAN in degrees (0-360).
 */
export function parseRAANFromTLE(line2: string): number {
  const raan = parseFloat(line2.substring(17, 25));
  return isNaN(raan) ? 0 : raan;
}

/**
 * Populate RAAN and ISL capability arrays from TLE data.
 * Call once during TLE init alongside setFullCatalog().
 */
export function computeISLArrays(
  tleLines2: string[],
  inclinations: Float32Array,
  launchYears: Uint16Array,
  count: number,
): { raanArray: Float32Array; islCapableArray: Uint8Array } {
  const raanArray = new Float32Array(count);
  const islCapableArray = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    raanArray[i] = parseRAANFromTLE(tleLines2[i]);
    islCapableArray[i] = isISLCapable(inclinations[i], launchYears[i]) ? 1 : 0;
  }

  return { raanArray, islCapableArray };
}
