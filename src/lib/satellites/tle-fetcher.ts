/**
 * TLE data fetching from CelesTrak.
 */

export interface TLEData {
  name: string;
  line1: string;
  line2: string;
  inclination: number; // degrees, parsed from TLE line 2 columns 8-16
}

const HF_TLE_URL =
  'https://huggingface.co/datasets/juliensimon/starlink-tle-latest/resolve/main/data/starlink.tle';
const CELESTRAK_FALLBACK_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle';
const HF_GPS_URL =
  'https://huggingface.co/datasets/juliensimon/starlink-tle-latest/resolve/main/data/gps.tle';
const CELESTRAK_GPS_FALLBACK_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle';

async function fetchTLEFrom(primaryUrl: string, fallbackUrl: string): Promise<TLEData[]> {
  // Primary: HF dataset
  try {
    const response = await fetch(primaryUrl);
    if (response.ok) {
      const text = await response.text();
      const data = parseTLEText(text);
      if (data.length > 0) return data;
    }
  } catch {
    // Fall through to CelesTrak
  }

  // Fallback: CelesTrak
  const response = await fetch(fallbackUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch TLE data: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return parseTLEText(text);
}

/**
 * Fetch Starlink TLE data from HF dataset (CelesTrak fallback) and parse into structured objects.
 */
export function fetchTLEData(): Promise<TLEData[]> {
  return fetchTLEFrom(HF_TLE_URL, CELESTRAK_FALLBACK_URL);
}

/**
 * Fetch GPS TLE data from HF dataset (CelesTrak fallback).
 */
export function fetchGpsTLEData(): Promise<TLEData[]> {
  return fetchTLEFrom(HF_GPS_URL, CELESTRAK_GPS_FALLBACK_URL);
}

/**
 * Parse raw TLE text into an array of {name, line1, line2} objects.
 * TLE format: 3 lines per satellite (name, line1, line2).
 */
export function parseTLEText(text: string): TLEData[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const results: TLEData[] = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    // Basic validation: line1 starts with '1 ', line2 starts with '2 '
    if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
      const inclination = parseFloat(line2.substring(8, 16).trim());
      results.push({ name, line1, line2, inclination });
    }
  }

  return results;
}
