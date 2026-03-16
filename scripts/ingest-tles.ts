import * as fs from 'fs';
import * as path from 'path';
import { initDatabase, closeDatabase } from '../src/lib/fleet/db';
import {
  insertTleSnapshot,
  rebuildDailySnapshots,
  getRecentAltitudes,
  getRecordCount,
} from '../src/lib/fleet/queries';
import { classifySatelliteStatus, getShellId } from '../src/lib/fleet/classify';
import { isISLCapable } from '../src/lib/satellites/isl-capability';
import {
  filterStarlinkName,
  altitudeFromMeanMotion,
  computeEpochValue,
  OmmRecord,
} from '../src/lib/fleet/ingest-helpers';
import type { TleSnapshotRow } from '../src/lib/fleet/queries';

const CELESTRAK_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json';
const CACHE_PATH = path.resolve(__dirname, '../data/last-celestrak-response.json');
const DB_PATH = path.resolve(__dirname, '../data/fleet.db');

const RETRY_DELAYS = [1000, 4000, 16000]; // exponential backoff

async function fetchWithRetry(url: string): Promise<OmmRecord[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1];
        console.log(`  Retry ${attempt}/${RETRY_DELAYS.length} after ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as OmmRecord[];

      // Cache successful response
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data), 'utf-8');
      console.log(`  Fetched ${data.length} records from CelesTrak`);
      return data;
    } catch (err) {
      lastError = err as Error;
      console.warn(`  Fetch attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }

  // All retries failed — try cache
  if (fs.existsSync(CACHE_PATH)) {
    console.log('  All retries failed. Loading cached response...');
    const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as OmmRecord[];
    console.log(`  Loaded ${cached.length} records from cache`);
    return cached;
  }

  throw new Error(`Failed to fetch CelesTrak data and no cache available: ${lastError?.message}`);
}

function processRecord(
  record: OmmRecord,
  now: Date
): TleSnapshotRow | null {
  // Compute altitude from mean motion via Kepler's third law
  const altitudeKm = altitudeFromMeanMotion(record.MEAN_MOTION, record.ECCENTRICITY);

  // Validate altitude range
  if (altitudeKm < 0 || altitudeKm > 2000) {
    return null;
  }

  const epochDate = new Date(record.EPOCH);

  // Compute epoch age
  const epochAgeHours = (now.getTime() - epochDate.getTime()) / (1000 * 3600);

  // Parse launch info from OBJECT_ID (e.g. "2019-074B")
  // Split into year and launch number directly since OBJECT_ID uses 4-digit year
  const idParts = record.OBJECT_ID.split('-');
  const launchYear = parseInt(idParts[0], 10);
  const launchNumber = parseInt(idParts[1], 10);

  // Get shell ID
  const shellId = getShellId(record.INCLINATION);

  // Get recent altitude history for status classification
  const recentAltitudes = getRecentAltitudes(record.NORAD_CAT_ID);
  const altitudeHistory = recentAltitudes.map((r) => r.altitude_km);
  const altitudeTimestamps = recentAltitudes.map((r) => r.epoch_ts);

  // Classify status
  const status = classifySatelliteStatus({
    inclination: record.INCLINATION,
    altitudeKm,
    eccentricity: record.ECCENTRICITY,
    epochAgeHours,
    altitudeHistory: [...altitudeHistory, altitudeKm],
    altitudeTimestamps: [
      ...altitudeTimestamps,
      Math.floor(epochDate.getTime() / 1000),
    ],
  });

  // Check ISL capability
  const islCapable = isISLCapable(record.INCLINATION, launchYear);

  // Compute epoch value (TLE-style YYDDD.fraction)
  const epochValue = computeEpochValue(record.EPOCH);

  return {
    norad_id: record.NORAD_CAT_ID,
    epoch: epochValue,
    epoch_ts: Math.floor(epochDate.getTime() / 1000),
    name: record.OBJECT_NAME,
    inclination: record.INCLINATION,
    raan: record.RA_OF_ASC_NODE,
    eccentricity: record.ECCENTRICITY,
    mean_motion: record.MEAN_MOTION,
    ndot: record.MEAN_MOTION_DOT,
    altitude_km: Math.round(altitudeKm * 100) / 100,
    launch_year: launchYear,
    launch_number: launchNumber,
    shell_id: shellId,
    status,
    is_isl_capable: islCapable ? 1 : 0,
    epoch_age_hours: Math.round(epochAgeHours * 100) / 100,
  };
}

async function main() {
  console.log('=== Starlink TLE Ingestion ===');
  console.log(`  Database: ${DB_PATH}`);

  // Ensure data directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // Initialize database
  initDatabase(DB_PATH);
  const countBefore = getRecordCount();
  console.log(`  Records before: ${countBefore}`);

  // Fetch data
  console.log('\n1. Fetching CelesTrak OMM data...');
  const records = await fetchWithRetry(CELESTRAK_URL);

  // Filter to STARLINK-\d+ only
  const starlinkRecords = records.filter((r) => filterStarlinkName(r.OBJECT_NAME));
  console.log(`  Filtered to ${starlinkRecords.length} Starlink satellites`);

  // Process and insert
  console.log('\n2. Processing TLEs...');
  const now = new Date();
  let inserted = 0;
  let rejected = 0;
  const affectedDates = new Set<string>();

  for (const record of starlinkRecords) {
    const row = processRecord(record, now);
    if (row) {
      insertTleSnapshot(row);
      inserted++;
      // Track affected date for daily snapshot rebuild
      const epochDate = new Date(record.EPOCH);
      affectedDates.add(epochDate.toISOString().split('T')[0]);
    } else {
      rejected++;
    }
  }

  console.log(`  Inserted: ${inserted}, Rejected: ${rejected}`);

  // Rebuild daily snapshots for affected dates
  console.log('\n3. Rebuilding daily snapshots...');
  // Always rebuild today's snapshot
  affectedDates.add(now.toISOString().split('T')[0]);

  for (const date of affectedDates) {
    rebuildDailySnapshots(date);
  }
  console.log(`  Rebuilt snapshots for ${affectedDates.size} date(s)`);

  // Summary
  const countAfter = getRecordCount();
  console.log('\n=== Summary ===');
  console.log(`  Records before: ${countBefore}`);
  console.log(`  Records after:  ${countAfter}`);
  console.log(`  New records:    ${countAfter - countBefore}`);

  closeDatabase();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  closeDatabase();
  process.exit(1);
});
