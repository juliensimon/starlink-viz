import { parseTLEText, type TLEData } from '@/lib/satellites/tle-fetcher';

const HF_GPS_URL =
  'https://huggingface.co/datasets/juliensimon/starlink-tle-latest/resolve/main/data/gps.tle';
const GPS_FALLBACK_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let cachedData: TLEData[] | null = null;
let cacheTimestamp = 0;

export async function GET() {
  const now = Date.now();

  if (cachedData && now - cacheTimestamp < SIX_HOURS_MS) {
    return Response.json(cachedData);
  }

  try {
    let text: string | null = null;

    // Primary: HF dataset
    try {
      const hfRes = await fetch(HF_GPS_URL);
      if (hfRes.ok) {
        const t = await hfRes.text();
        if (parseTLEText(t).length > 0) text = t;
      }
    } catch {
      // Fall through to CelesTrak
    }

    // Fallback: CelesTrak
    if (!text) {
      const response = await fetch(GPS_FALLBACK_URL);
      if (!response.ok) throw new Error(`GPS TLE fetch failed: ${response.status}`);
      text = await response.text();
    }

    const data = parseTLEText(text);
    cachedData = data;
    cacheTimestamp = now;
    return Response.json(data);
  } catch (error) {
    if (cachedData) return Response.json(cachedData);
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
