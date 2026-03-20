/**
 * Backfills historical Starlink TLE data from Space-Track.org into the fleet database.
 * Fetches monthly batches from the GP_History API (May 2019 → today).
 *
 * Requires env vars: SPACETRACK_USER, SPACETRACK_PASS
 * Usage: npx tsx scripts/backfill-spacetrack.ts [--from 2019-05] [--to 2026-03] [--upload]
 *
 * Data source: space-track.org (free account, US Space Force 18th Space Defense Squadron)
 */

import * as fs from 'fs';
import * as path from 'path';
import { initDatabase, closeDatabase, getDatabase } from '../src/lib/fleet/db';
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

const DB_PATH = path.resolve(__dirname, '../data/fleet.db');
const SPACETRACK_BASE = 'https://www.space-track.org';

// ── Auth ───────────────────────────────────────────────────────────────

let sessionCookie = '';

async function login(): Promise<void> {
  const user = process.env.SPACETRACK_USER;
  const pass = process.env.SPACETRACK_PASS;
  if (!user || !pass) {
    throw new Error('Set SPACETRACK_USER and SPACETRACK_PASS env vars');
  }

  const res = await fetch(`${SPACETRACK_BASE}/ajaxauth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `identity=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
  });

  // Extract chocolatechip session cookie
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/chocolatechip=([^;]+)/);
  if (match) {
    sessionCookie = `chocolatechip=${match[1]}`;
  }

  const text = await res.text();
  if (text !== '""' && text !== '' && !sessionCookie) {
    throw new Error(`Space-Track login failed: ${text}`);
  }
  if (!sessionCookie) {
    throw new Error('No session cookie received from Space-Track');
  }
  console.log('Authenticated with Space-Track');
}

// ── Fetch ──────────────────────────────────────────────────────────────

async function fetchMonth(yearMonth: string): Promise<OmmRecord[]> {
  const [year, month] = yearMonth.split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // Early Starlink sats (launch 2019-029, May 2019) were "TBA" in GP_History.
  // Query by OBJECT_ID for months before Nov 2019, by OBJECT_NAME after.
  // Early Starlink sats (launch 2019-029, May 2019) were "TBA" in GP_History.
  // Query by OBJECT_ID for months before Nov 2019, by OBJECT_NAME after.
  const useIntlDes = year === 2019 && month < 11;
  const nameFilter = useIntlDes ? 'OBJECT_ID/2019-029~~' : 'OBJECT_NAME/STARLINK~~';

  // Split into 2-week chunks to avoid Space-Track 500 errors on large result sets
  const mid = `${year}-${String(month).padStart(2, '0')}-16`;
  const chunks = [
    { from, to: mid },
    { from: mid, to: nextMonth },
  ];

  const allRecords: OmmRecord[] = [];
  for (const chunk of chunks) {
    const url = `${SPACETRACK_BASE}/basicspacedata/query/class/gp_history/${nameFilter}/EPOCH/${chunk.from}--${chunk.to}/orderby/EPOCH%20asc/format/json`;
    const records = await fetchChunk(url);
    allRecords.push(...records);
    if (records.length > 0) {
      // Respect rate limits between chunks
      await new Promise((r) => setTimeout(r, 30000));
    }
  }
  return allRecords;
}

async function fetchChunk(url: string): Promise<OmmRecord[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (attempt > 0) {
        const delay = 60000 * attempt; // 60s, 120s, 180s
        console.log(`    Retry ${attempt}/3 after ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }

      const res = await fetch(url, {
        headers: {
          Cookie: sessionCookie,
          'User-Agent': 'StarLink-MissionControl/1.0',
        },
        signal: AbortSignal.timeout(180000),
      });

      if (res.status === 429) {
        console.log('    Rate limited — waiting 180s...');
        await new Promise((r) => setTimeout(r, 180000));
        continue;
      }

      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as OmmRecord[] | { error: string }[];
      if (Array.isArray(data) && data.length > 0 && 'error' in data[0]) {
        throw new Error(`API error: ${(data[0] as { error: string }).error}`);
      }

      return data as OmmRecord[];
    } catch (err) {
      console.warn(`    Attempt ${attempt + 1} failed: ${(err as Error).message}`);
    }
  }

  console.warn(`    Chunk skipped after 4 failures`);
  return [];
}

// ── Process ────────────────────────────────────────────────────────────

function processRecord(record: OmmRecord, now: Date): TleSnapshotRow | null {
  // Accept STARLINK-\d+ names AND early "TBA" entries from 2019-029 launch
  const isStarlink = filterStarlinkName(record.OBJECT_NAME) ||
    record.OBJECT_ID.startsWith('2019-029');
  if (!isStarlink) return null;

  const altitudeKm = altitudeFromMeanMotion(record.MEAN_MOTION, record.ECCENTRICITY);
  if (altitudeKm < 0 || altitudeKm > 2000) return null;

  const epochDate = new Date(record.EPOCH);
  const epochAgeHours = (now.getTime() - epochDate.getTime()) / (1000 * 3600);

  const idParts = record.OBJECT_ID.split('-');
  const launchYear = parseInt(idParts[0], 10);
  const launchNumber = parseInt(idParts[1], 10);

  const shellId = getShellId(record.INCLINATION);

  const recentAltitudes = getRecentAltitudes(record.NORAD_CAT_ID);
  const altitudeHistory = recentAltitudes.map((r) => r.altitude_km);
  const altitudeTimestamps = recentAltitudes.map((r) => r.epoch_ts);

  const status = classifySatelliteStatus({
    inclination: record.INCLINATION,
    altitudeKm,
    eccentricity: record.ECCENTRICITY,
    epochAgeHours,
    altitudeHistory: [...altitudeHistory, altitudeKm],
    altitudeTimestamps: [...altitudeTimestamps, Math.floor(epochDate.getTime() / 1000)],
  });

  const islCapable = isISLCapable(record.INCLINATION, launchYear);
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

// ── Generate month list ────────────────────────────────────────────────

function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);

  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  const doUpload = args.includes('--upload');

  const now = new Date();
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromMonth = fromIdx >= 0 ? args[fromIdx + 1] : '2019-05';
  const toMonth = toIdx >= 0 ? args[toIdx + 1] : defaultTo;

  const months = monthRange(fromMonth, toMonth);

  console.log('=== Space-Track Historical Backfill ===');
  console.log(`  Range: ${fromMonth} → ${toMonth} (${months.length} months)`);
  console.log(`  Database: ${DB_PATH}`);

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  initDatabase(DB_PATH);
  const countBefore = getRecordCount();
  console.log(`  Records before: ${countBefore}`);

  await login();

  let totalInserted = 0;
  let totalFetched = 0;
  const affectedDates = new Set<string>();

  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    console.log(`\n[${i + 1}/${months.length}] Fetching ${month}...`);

    const records = await fetchMonth(month);
    console.log(`  ${records.length} records`);
    totalFetched += records.length;

    if (records.length === 0) continue;

    let inserted = 0;
    const db = getDatabase();
    const insertBatch = db.transaction(() => {
      for (const record of records) {
        const row = processRecord(record, now);
        if (row) {
          insertTleSnapshot(row);
          inserted++;
          const epochDate = new Date(record.EPOCH);
          affectedDates.add(epochDate.toISOString().split('T')[0]);
        }
      }
    });
    insertBatch();
    totalInserted += inserted;
    console.log(`  Inserted: ${inserted}`);

    // Respect Space-Track rate limits: wait 60s between months
    if (i < months.length - 1) {
      await new Promise((r) => setTimeout(r, 60000));
    }
  }

  // Rebuild daily snapshots
  console.log(`\nRebuilding daily snapshots for ${affectedDates.size} dates...`);
  const datesSorted = [...affectedDates].sort();
  for (let i = 0; i < datesSorted.length; i++) {
    rebuildDailySnapshots(datesSorted[i]);
    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${datesSorted.length} dates rebuilt`);
    }
  }

  const countAfter = getRecordCount();
  console.log('\n=== Summary ===');
  console.log(`  Fetched:  ${totalFetched.toLocaleString()} records`);
  console.log(`  Inserted: ${totalInserted.toLocaleString()} records`);
  console.log(`  DB total: ${countAfter.toLocaleString()} records`);
  console.log(`  DB size:  ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1)} MB`);

  closeDatabase();

  // Upload to HF dataset
  if (doUpload) {
    console.log('\nUploading to HF dataset...');
    const { execFileSync } = await import('child_process');
    execFileSync('hf', ['upload', 'juliensimon/starlink-fleet-data', DB_PATH, 'fleet.db', '--repo-type', 'dataset'], {
      stdio: 'inherit',
    });
    console.log('Uploaded fleet.db to juliensimon/starlink-fleet-data');
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  closeDatabase();
  process.exit(1);
});
