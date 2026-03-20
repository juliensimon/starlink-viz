/**
 * Fetches Starlink ground station locations from multiple sources,
 * reconciles data, and updates data/ground-stations.json.
 *
 * Sources:
 *   1. starlinkinsider.com — scrapes gateway list with status indicators
 *      https://starlinkinsider.com/starlink-gateway-locations/
 *      Credit: Starlink Insider maintains a comprehensive, community-curated
 *      list of Starlink gateway locations with operational status.
 *
 *   2. starlink.sx/gateways.json — structured JSON with coordinates, antenna
 *      counts, and Ka/E-band operational status per gateway.
 *      Credit: starlink.sx provides detailed ground station data including
 *      frequency bands and facility specifications.
 *
 * Usage: npx tsx scripts/update-ground-stations.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Types ──────────────────────────────────────────────────────────────

export interface StationCandidate {
  name: string;
  lat: number;
  lon: number;
  status: 'operational' | 'planned';
  type: 'gateway' | 'pop';
  source: string;
}

export interface Station {
  name: string;
  lat: number;
  lon: number;
  status: 'operational' | 'planned';
  type: 'gateway' | 'pop';
}

interface DataFile {
  lastUpdated: string;
  stations: Station[];
}

interface MetaEntry {
  lastSeen: string; // ISO date
  missCount: number;
}

interface MetaFile {
  [canonicalName: string]: MetaEntry;
}

interface ChangeReport {
  added: string[];
  statusChanged: { name: string; from: string; to: string }[];
  coordConflicts: { name: string; source: string; distKm: number }[];
  sourcesUsed: string[];
  sourcesFailed: string[];
  flaggedForRemoval: string[];
  totalStations: number;
}

// ── Paths ──────────────────────────────────────────────────────────────

const __dirname = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_PATH = join(ROOT, 'data/ground-stations.json');
const META_PATH = join(ROOT, 'data/ground-stations-meta.json');
const REPORT_PATH = join(ROOT, 'data/ground-stations-update-report.md');

// ── Exported utilities (used by tests) ─────────────────────────────────

/**
 * Normalize a station name to a canonical key for matching.
 * Lowercase, trim, expand common abbreviations.
 */
// ISO 2-letter → full country/region name used in our data
const COUNTRY_CODES: Record<string, string> = {
  ng: 'nigeria', jp: 'japan', ph: 'philippines', fj: 'fiji',
  au: 'australia', nz: 'nz', mx: 'mexico', br: 'brazil',
  cl: 'chile', ar: 'argentina', co: 'colombia', pe: 'peru',
  de: 'germany', fr: 'france', gb: 'uk', uk: 'uk', ie: 'ireland',
  it: 'italy', es: 'spain', pt: 'portugal', no: 'norway',
  pl: 'poland', lt: 'lithuania', tr: 'turkey', om: 'oman',
  cw: 'curaçao', do: 'dr', pr: 'pr', gu: 'guam',
  sg: 'singapore', my: 'malaysia', id: 'indonesia', th: 'thailand',
  in: 'india', kr: 'south korea', tw: 'taiwan', ke: 'kenya',
  za: 'south africa', gh: 'ghana', bb: 'barbados',
  nl: 'netherlands', cz: 'czech republic',
};

// Australian state codes used in starlink.sx (e.g., "Boorowa, NSW, AU")
const AU_STATE_CODES = new Set(['nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt']);
// Canadian province codes
const CA_PROVINCE_CODES = new Set(['on', 'qc', 'ns', 'nl', 'bc', 'ab', 'mb', 'sk', 'nb', 'pe', 'nu', 'nt', 'yk']);

export function normalizeName(name: string): string {
  let n = name
    .trim()
    .toLowerCase()
    // Expand abbreviations (with or without period)
    .replace(/\bst\.?\s+/g, 'saint ')
    .replace(/\bmt\.?\s+/g, 'mount ')
    .replace(/\bft\.?\s+/g, 'fort ')
    // Normalize punctuation for matching
    .replace(/['']/g, "'")      // smart quotes → straight
    .replace(/[-–—]/g, ' ')     // hyphens/dashes → space
    .replace(/[.]/g, '')        // remove remaining periods
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize country codes in the suffix: "city, XX" → "city, full country"
  // BUT: don't convert US state or Canadian province abbreviations
  const US_STATES = new Set([
    'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
    'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
    'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
    'va','wa','wv','wi','wy','dc','pr','gu',
  ]);

  const parts = n.split(',').map((p) => p.trim());
  if (parts.length === 3) {
    const cc = parts[2];
    const mid = parts[1];
    if (COUNTRY_CODES[cc] && !US_STATES.has(cc) && !CA_PROVINCE_CODES.has(cc)) {
      // "City, State, AU" → "city, australia" (drop the state for matching)
      n = `${parts[0]}, ${COUNTRY_CODES[cc]}`;
    } else if (AU_STATE_CODES.has(mid) || CA_PROVINCE_CODES.has(mid)) {
      // "City, ON, CA" → "city, on" (keep province, drop country)
      n = `${parts[0]}, ${parts[1]}`;
    }
  } else if (parts.length === 2) {
    const cc = parts[1];
    // Only convert if it's a country code AND not a US state/CA province
    if (COUNTRY_CODES[cc] && !US_STATES.has(cc) && !CA_PROVINCE_CODES.has(cc)) {
      n = `${parts[0]}, ${COUNTRY_CODES[cc]}`;
    }
  }

  return n;
}

/**
 * Haversine distance in km between two lat/lon points.
 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Merge two status values. Operational wins over planned
 * (stations go operational, rarely reverse).
 */
export function mergeStatus(
  a: 'operational' | 'planned',
  b: 'operational' | 'planned',
): 'operational' | 'planned' {
  return a === 'operational' || b === 'operational' ? 'operational' : 'planned';
}

/**
 * Sanity check: reject a source if it returns fewer than 50% of known stations.
 * Returns true if the source passes the check.
 */
export function sanityCheck(
  candidateCount: number,
  knownCount: number,
): boolean {
  if (knownCount === 0) return true;
  return candidateCount >= knownCount * 0.5;
}

// ── Fetchers ───────────────────────────────────────────────────────────

const USER_AGENT = 'StarLink-MissionControl/1.0';

// US state abbreviation map (full name → 2-letter code)
const US_STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY',
};

// Canadian province abbreviation map
const CA_PROVINCE_ABBR: Record<string, string> = {
  ontario: 'ON', quebec: 'QC', 'nova scotia': 'NS', newfoundland: 'NL',
  'british columbia': 'BC', alberta: 'AB', manitoba: 'MB', saskatchewan: 'SK',
  'new brunswick': 'NB', 'prince edward island': 'PE',
};

/**
 * Abbreviate "City, Full State Name" → "City, ST" for US/Canadian entries.
 * Leaves non-US/CA entries unchanged.
 */
function abbreviateRegion(city: string, region: string): string {
  const lower = region.toLowerCase().trim();
  const abbr = US_STATE_ABBR[lower] || CA_PROVINCE_ABBR[lower];
  return abbr ? `${city}, ${abbr}` : `${city}, ${region}`;
}

async function fetchStarlinkInsider(): Promise<StationCandidate[]> {
  const url = 'https://starlinkinsider.com/starlink-gateway-locations/';
  console.log(`[starlinkinsider] Fetching ${url}...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const fullHtml = await res.text();

  // Scope to article content to exclude nav menus and footers
  const articleStart = fullHtml.indexOf('<article');
  const articleEnd = fullHtml.indexOf('</article>');
  const html = articleStart >= 0 && articleEnd > articleStart
    ? fullHtml.slice(articleStart, articleEnd)
    : fullHtml;

  const candidates: StationCandidate[] = [];
  const seen = new Set<string>();

  // Valid status indicators — only entries with these are actual stations
  const VALID_STATUSES = ['live', 'construction ongoing', 'construction pending', 'unknown'];

  // Parse status from parenthetical: (live), (construction ongoing), (construction pending), (unknown)
  // Returns null if the entry doesn't have a valid status (= not a station)
  function parseStatus(text: string): { name: string; status: 'operational' | 'planned' } | null {
    const statusMatch = text.match(/\s*\(([^)]+)\)\s*$/);
    if (!statusMatch) return null;

    const raw = statusMatch[1].toLowerCase();
    if (!VALID_STATUSES.includes(raw)) return null;

    const status: 'operational' | 'planned' = raw === 'live' ? 'operational' : 'planned';
    const name = text.replace(/\s*\([^)]+\)\s*$/, '').trim();

    return { name, status };
  }

  // Country suffixes for international stations that need country context
  const countryForContext: Record<string, string> = {
    nigeria: 'Nigeria', japan: 'Japan', philippines: 'Philippines',
    'dominican republic': 'DR', mexico: 'Mexico', 'puerto rico': 'PR',
    france: 'France', germany: 'Germany', ireland: 'Ireland',
    italy: 'Italy', lithuania: 'Lithuania', norway: 'Norway',
    poland: 'Poland', portugal: 'Portugal', spain: 'Spain',
    'united kingdom': 'UK', oman: 'Oman', turkey: 'Turkey',
    australia: 'Australia', fiji: 'Fiji', 'new zealand': 'NZ',
    argentina: 'Argentina', brazil: 'Brazil', chile: 'Chile',
    'curaçao': 'Curaçao', curacao: 'Curaçao', colombia: 'Colombia',
  };

  // Build document-order sequence of country markers and station entries
  // Country names appear in: <p>...in <strong>Country</strong>:</p>
  // Station names appear in: <li>City (status)</li> or <li><a>City (status)</a></li>
  const elements: { type: 'country' | 'li'; text: string; index: number }[] = [];

  let match;

  // Match country names in <strong> tags within paragraphs
  const countryPattern = /<strong>(?:the\s+)?([^<]+)<\/strong>/gi;
  while ((match = countryPattern.exec(html)) !== null) {
    elements.push({ type: 'country', text: match[1].trim(), index: match.index });
  }

  // Match <li> entries — handle both plain text and <a>-wrapped text
  // <li>City (status)</li> or <li><a href="...">City (status)</a></li>
  const liPattern = /<li[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/li>/gi;
  while ((match = liPattern.exec(html)) !== null) {
    elements.push({ type: 'li', text: match[1].trim(), index: match.index });
  }
  elements.sort((a, b) => a.index - b.index);

  let currentCountry = '';

  for (const el of elements) {
    if (el.type === 'country') {
      const lower = el.text.toLowerCase().trim();
      if (countryForContext[lower] !== undefined || lower === 'united states' || lower === 'canada') {
        currentCountry = lower;
      }
      continue;
    }

    // It's a <li> element
    const text = el.text.trim();
    if (text.length < 2 || text.length > 100) continue;

    const parsed = parseStatus(text);
    if (!parsed) continue; // Not a station entry (no valid status indicator)
    const { name: rawName, status } = parsed;
    if (rawName.length < 2) continue;

    let stationName: string;

    if (rawName.includes(',')) {
      const [city, region] = rawName.split(',', 2);
      const trimmedRegion = region.trim();

      if (!trimmedRegion) {
        // Trailing comma with no region (e.g., "Luz," on the site) — use country context
        if (currentCountry && countryForContext[currentCountry]) {
          stationName = `${city.trim()}, ${countryForContext[currentCountry]}`;
        } else {
          stationName = city.trim();
        }
      } else if (currentCountry === 'united states' || currentCountry === 'canada') {
        // "City, State/Province" — abbreviate
        stationName = abbreviateRegion(city.trim(), trimmedRegion);
      } else {
        // International "City, Region" — keep as-is
        stationName = `${city.trim()}, ${trimmedRegion}`;
      }
    } else if (currentCountry === 'united states' || currentCountry === 'canada') {
      // US/CA entry without comma — shouldn't happen but skip
      continue;
    } else if (currentCountry && countryForContext[currentCountry]) {
      // International entry — append country
      stationName = `${rawName}, ${countryForContext[currentCountry]}`;
    } else {
      // No country context and no comma — use as-is
      stationName = rawName;
    }

    const key = normalizeName(stationName);
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({ name: stationName, lat: 0, lon: 0, status, type: 'gateway', source: 'starlinkinsider' });
  }

  console.log(`[starlinkinsider] Found ${candidates.length} station names`);
  return candidates;
}

// ISO country code → display name for output normalization
const CC_TO_DISPLAY: Record<string, string> = {
  AU: 'Australia', NZ: 'NZ', JP: 'Japan', NG: 'Nigeria',
  MX: 'Mexico', BR: 'Brazil', CL: 'Chile', AR: 'Argentina', CO: 'Colombia',
  DE: 'Germany', FR: 'France', GB: 'UK', IE: 'Ireland', IT: 'Italy',
  ES: 'Spain', PT: 'Portugal', NO: 'Norway', PL: 'Poland', LT: 'Lithuania',
  TR: 'Turkey', OM: 'Oman', PH: 'Philippines', FJ: 'Fiji',
  DO: 'DR', CW: 'Curaçao', CZ: 'Czech Republic',
  KE: 'Kenya', ZA: 'South Africa', KR: 'South Korea', TW: 'Taiwan',
  ID: 'Indonesia', MY: 'Malaysia', TH: 'Thailand', IN: 'India',
  GH: 'Ghana', BB: 'Barbados', SG: 'Singapore', PE: 'Peru',
};

/**
 * Normalize a station name to a consistent display format:
 * - US/CA: "City, ST" (2-letter state/province code)
 * - International: "City, Country" (full country name)
 * Removes intermediate state codes from 3-part names (e.g. "Boorowa, NSW, AU" → "Boorowa, Australia")
 */
function normalizeDisplayName(name: string): string {
  const parts = name.split(',').map((p) => p.trim());

  if (parts.length === 3) {
    const cc = parts[2].toUpperCase();
    if (CC_TO_DISPLAY[cc]) {
      return `${parts[0]}, ${CC_TO_DISPLAY[cc]}`;
    }
    // US/CA with province: "Marathon, ON, CA" → "Marathon, ON"
    return `${parts[0]}, ${parts[1]}`;
  }

  if (parts.length === 2) {
    const suffix = parts[1].toUpperCase();
    // Don't convert if it's a US state or CA province abbreviation
    const usAndCa = new Set([
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
      'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
      'VA','WA','WV','WI','WY','DC','PR','GU',
      'ON','QC','NS','NL','BC','AB','MB','SK','NB','PE','NU','NT','YK',
    ]);
    if (!usAndCa.has(suffix) && CC_TO_DISPLAY[suffix]) {
      return `${parts[0]}, ${CC_TO_DISPLAY[suffix]}`;
    }
  }

  return name;
}

// Entries with freq "" or "TTC" and no Ka/E antennas are PoPs (data centers / IXPs).
// Also, entries whose notes mention "PoP", "POP", "IXP", "colo", or "data center" are PoPs.
function classifyStarlinkSxEntry(entry: Record<string, unknown>): 'gateway' | 'pop' {
  const freq = String(entry.freq || '').toLowerCase();
  const notes = String(entry.notes || '').toLowerCase();

  // Explicit PoP indicators in notes
  if (/\b(pop|ixp|colo|data.?cent|peering|exchange)\b/.test(notes)) return 'pop';

  // No frequency band = not a ground station with antennas
  if (!freq || freq === 'ttc') return 'pop';

  // Has Ka or E band = gateway
  return 'gateway';
}

async function fetchStarlinkSx(): Promise<StationCandidate[]> {
  const url = 'https://starlink.sx/gateways.json';
  console.log(`[starlink.sx] Fetching ${url}...`);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data)) {
      console.log('[starlink.sx] Response is not an array, skipping');
      return [];
    }

    const candidates: StationCandidate[] = [];
    let popCount = 0;
    for (const entry of data) {
      if (!entry.lat || !entry.lng || !entry.town) continue;

      // Determine operational status from Ka/E band operational flags
      const kaOp = (entry as Record<string, unknown> & { ka?: { operational?: boolean } }).ka?.operational === true;
      const eOp = (entry as Record<string, unknown> & { e?: { operational?: boolean } }).e?.operational === true;
      const isOperational = kaOp || eOp;

      const town = String(entry.town).trim();
      const type = classifyStarlinkSxEntry(entry as Record<string, unknown>);
      if (type === 'pop') popCount++;

      candidates.push({
        name: town,
        lat: parseFloat(String(entry.lat)),
        lon: parseFloat(String(entry.lng)),
        status: isOperational ? 'operational' : 'planned',
        type,
        source: 'starlink.sx',
      });
    }
    console.log(`[starlink.sx] Found ${candidates.length} stations (${candidates.length - popCount} gateways, ${popCount} PoPs)`);
    return candidates;
  } catch (err) {
    console.log(`[starlink.sx] Failed (best-effort): ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ── PoP list from Starlink rDNS data ───────────────────────────────────

// Decode PoP identifiers from starlinkisp.net rDNS to city names
const POP_ID_TO_CITY: Record<string, string> = {
  ackl: 'Auckland', almy: 'Almaty', ashn: 'Ashburn', atla: 'Atlanta',
  bgta: 'Bogota', bnss: 'Buenos Aires', brsa: 'Brasilia', brse: 'Brisbane',
  chco: 'Chicago', chrh: 'Christchurch', clgy: 'Calgary', dhka: 'Dhaka',
  dlls: 'Dallas', dnvr: 'Denver', doha: 'Doha', drwn: 'Darwin',
  frnt: 'Frankfurt', frta: 'Fortaleza', gtmy: 'Guatemala City',
  jhng: 'Johannesburg', jtna: 'Jakarta', kent: 'Kent', knsy: 'Kansas City',
  lgos: 'Lagos', lima: 'Lima', lndn: 'London', lsan: 'Los Angeles',
  mdrd: 'Madrid', mlbe: 'Melbourne', mlnn: 'Milan', mmbi: 'Mumbai',
  mmmi: 'Miami', mnla: 'Manila', mntl: 'Montreal', mpls: 'Minneapolis',
  msct: 'Muscat', nrbi: 'Nairobi', nwyy: 'New York', prth: 'Perth',
  qrto: 'Queretaro', sfia: 'Sofia', slty: 'Salt Lake City', snge: 'Singapore',
  snje: 'San Jose', snto: 'Santiago', splo: 'Sao Paulo', srba: 'Surabaya',
  sttl: 'Seattle', sydy: 'Sydney', tkyo: 'Tokyo', tmpe: 'Tempe',
  wrsw: 'Warsaw',
};

/**
 * Fetch the latest PoP list from the starlink-geoip-data repo.
 * Returns a set of canonical PoP city names (lowercase).
 */
async function fetchPopCities(): Promise<Set<string>> {
  const popCities = new Set<string>();

  // Always include the decoded static list as baseline
  for (const city of Object.values(POP_ID_TO_CITY)) {
    popCities.add(city.toLowerCase());
  }

  // Try fetching latest from GitHub for any new PoPs
  try {
    // Find latest snapshot file
    const dirUrl = 'https://api.github.com/repos/clarkzjw/starlink-geoip-data/contents/pop/20263';
    const dirRes = await fetch(dirUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    if (dirRes.ok) {
      const files = await dirRes.json() as { name: string; download_url: string }[];
      const csvFiles = files.filter(f => f.name.endsWith('.csv')).sort((a, b) => b.name.localeCompare(a.name));
      if (csvFiles.length > 0) {
        const csvRes = await fetch(csvFiles[0].download_url, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(10000),
        });
        if (csvRes.ok) {
          const csv = await csvRes.text();
          const popIds = new Set<string>();
          for (const line of csv.split('\n')) {
            const popId = line.split(',')[1]?.trim();
            if (popId) popIds.add(popId.slice(0, 4)); // first 4 chars = city code
          }
          for (const id of popIds) {
            if (POP_ID_TO_CITY[id]) {
              popCities.add(POP_ID_TO_CITY[id].toLowerCase());
            }
          }
          console.log(`[pop-list] Fetched ${popIds.size} PoP IDs, ${popCities.size} unique cities`);
        }
      }
    }
  } catch (err) {
    console.log(`[pop-list] GitHub fetch failed (using static list): ${err instanceof Error ? err.message : err}`);
  }

  return popCities;
}

/**
 * Tag stations as PoPs if their city name matches a known PoP city.
 * A station is a PoP if its city matches AND it doesn't have gateway antennas
 * (i.e., it wasn't tagged as gateway by starlink.sx freq data).
 */
function tagPops(stations: Station[], popCities: Set<string>): void {
  let tagged = 0;
  for (const s of stations) {
    if (s.type === 'pop') continue; // already tagged
    const city = s.name.split(',')[0].toLowerCase().trim();
    if (popCities.has(city)) {
      s.type = 'pop';
      tagged++;
    }
  }
  if (tagged > 0) {
    console.log(`  Tagged ${tagged} stations as PoPs from authoritative PoP list`);
  }
}

// ── Geocoding (for new stations from sources without coordinates) ──────

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.error(`  Geocode failed for "${query}":`, err);
  }
  return null;
}

// ── Load existing data ─────────────────────────────────────────────────

function loadExisting(): DataFile {
  try {
    const raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
    return {
      lastUpdated: raw.lastUpdated || '',
      stations: (raw.stations || []).map((s: Record<string, unknown>) => ({
        name: String(s.name),
        lat: Number(s.lat),
        lon: Number(s.lon),
        status: s.status === 'planned' ? 'planned' : 'operational',
        type: s.type === 'pop' ? 'pop' as const : 'gateway' as const,
      })),
    };
  } catch {
    return { lastUpdated: '', stations: [] };
  }
}

function loadMeta(): MetaFile {
  try {
    return JSON.parse(readFileSync(META_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

// ── Reconciliation ─────────────────────────────────────────────────────

async function reconcile(
  existing: Station[],
  allCandidates: StationCandidate[],
  report: ChangeReport,
): Promise<Station[]> {
  // Build existing lookup by canonical name
  const existingByKey = new Map<string, Station>();
  for (const s of existing) {
    existingByKey.set(normalizeName(s.name), s);
  }

  // Group candidates by canonical name, preferring ones with coordinates
  const candidatesByKey = new Map<string, StationCandidate[]>();
  for (const c of allCandidates) {
    const key = normalizeName(c.name);
    if (!candidatesByKey.has(key)) candidatesByKey.set(key, []);
    candidatesByKey.get(key)!.push(c);
  }

  // Start with existing stations, update as needed
  const result = new Map<string, Station>();

  for (const [key, station] of existingByKey) {
    const candidates = candidatesByKey.get(key);
    if (!candidates) {
      // Station missing from all sources — keep it (don't auto-remove)
      result.set(key, station);
      continue;
    }

    // Check for status updates
    let newStatus = station.status;
    for (const c of candidates) {
      newStatus = mergeStatus(newStatus, c.status);
    }
    if (newStatus !== station.status) {
      report.statusChanged.push({ name: station.name, from: station.status, to: newStatus });
    }

    // Check for coordinate conflicts (>50km)
    for (const c of candidates) {
      if (c.lat !== 0 && c.lon !== 0) {
        const dist = haversineKm(station.lat, station.lon, c.lat, c.lon);
        if (dist > 50) {
          report.coordConflicts.push({ name: station.name, source: c.source, distKm: Math.round(dist) });
        }
      }
    }

    result.set(key, { ...station, status: newStatus });
  }

  // Add new stations (present in sources but not in existing)
  for (const [key, candidates] of candidatesByKey) {
    if (existingByKey.has(key)) continue;

    // Pick the best candidate (prefer one with coordinates)
    const withCoords = candidates.find((c) => c.lat !== 0 && c.lon !== 0);
    const best = withCoords || candidates[0];

    // If no coordinates, geocode
    if (best.lat === 0 && best.lon === 0) {
      // Rate-limit Nominatim (1 req/sec policy)
      await new Promise((r) => setTimeout(r, 1100));
      console.log(`  Geocoding new station: ${best.name}`);
      const coords = await geocode(best.name);
      if (!coords) {
        console.log(`    -> Not found, skipping`);
        continue;
      }
      best.lat = coords.lat;
      best.lon = coords.lon;
      console.log(`    -> ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`);
    }

    // Before adding as new, check if an existing station is within 5km
    // (catches cross-source name mismatches like "Awarua" vs "Awaura")
    let isDuplicate = false;
    for (const existing of result.values()) {
      if (haversineKm(best.lat, best.lon, existing.lat, existing.lon) < 5) {
        // Merge: update status if needed, skip adding
        const merged = mergeStatus(existing.status, best.status);
        if (merged !== existing.status) {
          report.statusChanged.push({ name: existing.name, from: existing.status, to: merged });
          existing.status = merged;
        }
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;

    const displayName = normalizeDisplayName(best.name);
    result.set(key, {
      name: displayName,
      lat: best.lat,
      lon: best.lon,
      status: best.status,
      type: best.type,
    });
    report.added.push(displayName);
  }

  // Final dedup pass: merge any stations within 5km of each other
  // (catches duplicates introduced by different naming across sources)
  const stations = [...result.values()];
  const deduped: Station[] = [];
  const merged = new Set<number>();

  for (let i = 0; i < stations.length; i++) {
    if (merged.has(i)) continue;
    let keeper = stations[i];

    for (let j = i + 1; j < stations.length; j++) {
      if (merged.has(j)) continue;
      if (haversineKm(keeper.lat, keeper.lon, stations[j].lat, stations[j].lon) < 5) {
        // Keep the station with the more descriptive name (longer, or from existing data)
        const other = stations[j];
        if (other.name.length > keeper.name.length) {
          keeper = { ...other, status: mergeStatus(keeper.status, other.status) };
        } else {
          keeper = { ...keeper, status: mergeStatus(keeper.status, other.status) };
        }
        merged.add(j);
      }
    }
    deduped.push(keeper);
  }

  if (merged.size > 0) {
    console.log(`  Deduped ${merged.size} stations within 5km of another`);
  }

  return deduped.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Meta tracking (lastSeen / miss count) ──────────────────────────────

function updateMeta(
  meta: MetaFile,
  existing: Station[],
  seenKeys: Set<string>,
  report: ChangeReport,
): MetaFile {
  const today = new Date().toISOString().slice(0, 10);
  const updated: MetaFile = { ...meta };

  for (const station of existing) {
    const key = normalizeName(station.name);
    if (seenKeys.has(key)) {
      updated[key] = { lastSeen: today, missCount: 0 };
    } else {
      const prev = updated[key] || { lastSeen: today, missCount: 0 };
      prev.missCount += 1;
      updated[key] = prev;
      if (prev.missCount >= 4) {
        report.flaggedForRemoval.push(station.name);
      }
    }
  }

  return updated;
}

// ── Change report ──────────────────────────────────────────────────────

function writeReport(report: ChangeReport): void {
  const lines: string[] = [
    '# Ground Station Update Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**Total stations:** ${report.totalStations}`,
    '',
    '## Sources',
    `- Used: ${report.sourcesUsed.length > 0 ? report.sourcesUsed.join(', ') : 'none'}`,
    `- Failed: ${report.sourcesFailed.length > 0 ? report.sourcesFailed.join(', ') : 'none'}`,
    '',
  ];

  if (report.added.length > 0) {
    lines.push('## Added', ...report.added.map((n) => `- ${n}`), '');
  }

  if (report.statusChanged.length > 0) {
    lines.push(
      '## Status Changed',
      ...report.statusChanged.map((c) => `- ${c.name}: ${c.from} → ${c.to}`),
      '',
    );
  }

  if (report.coordConflicts.length > 0) {
    lines.push(
      '## Coordinate Conflicts (>50km, kept existing)',
      ...report.coordConflicts.map(
        (c) => `- ${c.name}: ${c.distKm}km difference (source: ${c.source})`,
      ),
      '',
    );
  }

  if (report.flaggedForRemoval.length > 0) {
    lines.push(
      '## Flagged for Removal (4+ consecutive misses)',
      ...report.flaggedForRemoval.map((n) => `- ${n}`),
      '',
    );
  }

  if (
    report.added.length === 0 &&
    report.statusChanged.length === 0 &&
    report.coordConflicts.length === 0 &&
    report.flaggedForRemoval.length === 0
  ) {
    lines.push('No changes detected.', '');
  }

  writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`Change report written to ${REPORT_PATH}`);
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const existing = loadExisting();
  const meta = loadMeta();
  console.log(
    `Existing: ${existing.stations.length} stations (last updated: ${existing.lastUpdated || 'never'})`,
  );

  const report: ChangeReport = {
    added: [],
    statusChanged: [],
    coordConflicts: [],
    sourcesUsed: [],
    sourcesFailed: [],
    flaggedForRemoval: [],
    totalStations: 0,
  };

  // Fetch from all sources in parallel
  const results = await Promise.allSettled([
    fetchStarlinkInsider(),
    fetchStarlinkSx(),
  ]);

  const sourceNames = ['starlinkinsider', 'starlink.sx'];
  const allCandidates: StationCandidate[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      console.error(`[${sourceNames[i]}] Failed: ${result.reason}`);
      report.sourcesFailed.push(sourceNames[i]);
      continue;
    }

    const candidates = result.value;
    if (candidates.length === 0) {
      report.sourcesFailed.push(sourceNames[i]);
      continue;
    }

    // Sanity check: reject if <50% of known stations
    if (!sanityCheck(candidates.length, existing.stations.length)) {
      console.warn(
        `[${sourceNames[i]}] Sanity check failed: ${candidates.length} candidates vs ${existing.stations.length} known — treating as scraping failure`,
      );
      report.sourcesFailed.push(sourceNames[i]);
      continue;
    }

    report.sourcesUsed.push(sourceNames[i]);
    allCandidates.push(...candidates);
  }

  if (allCandidates.length === 0) {
    console.log('All sources failed or returned no data. No changes made.');
    report.totalStations = existing.stations.length;
    writeReport(report);
    return;
  }

  // Fetch authoritative PoP list
  const popCities = await fetchPopCities();

  // Reconcile
  const stations = await reconcile(existing.stations, allCandidates, report);

  // Tag PoPs from authoritative rDNS data
  tagPops(stations, popCities);
  report.totalStations = stations.length;

  // Track what was seen across all sources for meta
  const seenKeys = new Set<string>();
  for (const c of allCandidates) {
    seenKeys.add(normalizeName(c.name));
  }

  // Update meta (lastSeen tracking)
  const updatedMeta = updateMeta(meta, existing.stations, seenKeys, report);
  writeFileSync(META_PATH, JSON.stringify(updatedMeta, null, 2));

  // Write updated data
  const output: DataFile = {
    lastUpdated: new Date().toISOString(),
    stations,
  };
  writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));

  // Write change report
  writeReport(report);

  console.log(
    `\nDone. ${stations.length} total stations (${report.added.length} added, ${report.statusChanged.length} status changes).`,
  );
}

main().catch(console.error);
