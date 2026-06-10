/**
 * Shared TLE international-designator (COSPAR ID) parsing.
 *
 * Single home for the NORAD 2-digit-year pivot rule, used by the live app
 * (satellite-store, propagator, tooltip) and fleet ingestion alike.
 */

/** NORAD 2-digit year convention: 57-99 → 1957-1999, 00-56 → 2000-2056. */
export function pivotTwoDigitYear(yy: number): number {
  return yy >= 57 ? 1900 + yy : 2000 + yy;
}

/** Launch year from TLE line 1 (designator columns 9-10). 0 when missing/invalid. */
export function parseLaunchYear(line1: string): number {
  const yy = parseInt(line1.substring(9, 11), 10);
  return isNaN(yy) ? 0 : pivotTwoDigitYear(yy);
}

/** Full designator from TLE line 1 → { year, launch } or null when blank (TBA objects). */
export function parseLaunchInfoFromLine1(line1: string): { year: number; launch: string } | null {
  const intlDesig = line1.substring(9, 17).trim();
  if (!intlDesig) return null;
  const yy = parseInt(intlDesig.substring(0, 2), 10);
  if (isNaN(yy)) return null;
  return { year: pivotTwoDigitYear(yy), launch: intlDesig.substring(2, 5).trim() };
}
