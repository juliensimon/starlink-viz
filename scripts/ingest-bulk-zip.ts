/**
 * Ingests Starlink TLE data from Space-Track bulk yearly zip files.
 *
 * These zips contain raw 2-line TLE format for ALL objects (not just Starlink).
 * The script streams through each file, filters for Starlink NORAD IDs, parses
 * TLE fields, and inserts into the fleet database.
 *
 * Download zips from: https://ln5.sync.com/dl/afd354190/c5cd2q72-a5qjzp4q-nbjdiqkr-cenajuqu
 * Place in data/bulk/ or ~/Downloads/
 *
 * Usage: npx tsx scripts/ingest-bulk-zip.ts [--dir ~/Downloads] [--upload]
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, spawn } from 'child_process';
import { createInterface } from 'readline';
import { initDatabase, closeDatabase, getDatabase } from '../src/lib/fleet/db';
import {
  insertTleSnapshot,
  rebuildDailySnapshots,
  getRecentAltitudes,
  getRecordCount,
} from '../src/lib/fleet/queries';
import { classifySatelliteStatus, getShellId } from '../src/lib/fleet/classify';
import { isISLCapable } from '../src/lib/satellites/isl-capability';
import { altitudeFromMeanMotion } from '../src/lib/fleet/ingest-helpers';
import type { TleSnapshotRow } from '../src/lib/fleet/queries';

const DB_PATH = path.resolve(__dirname, '../data/fleet.db');

// ── Known Starlink NORAD ID set ──────────────────────────────────────

function loadStarlinkNoradIds(): Set<number> {
  const db = getDatabase();
  const rows = db.prepare('SELECT DISTINCT norad_id FROM tle_snapshots').all() as { norad_id: number }[];
  return new Set(rows.map((r) => r.norad_id));
}

// ── TLE Parsing ──────────────────────────────────────────────────────

interface ParsedTle {
  noradId: number;
  intlDesignator: string;
  epochYear: number;
  epochDay: number;
  ndot: number;
  bstar: number;
  inclination: number;
  raan: number;
  eccentricity: number;
  argPerigee: number;
  meanAnomaly: number;
  meanMotion: number;
}

function parseTlePair(line1: string, line2: string): ParsedTle | null {
  try {
    const noradId = parseInt(line1.substring(2, 7).trim(), 10);
    const intlDesignator = line1.substring(9, 17).trim();

    // Epoch: 2-digit year + day of year with fractional part
    const epochYr = parseInt(line1.substring(18, 20).trim(), 10);
    const epochYear = epochYr >= 57 ? 1900 + epochYr : 2000 + epochYr;
    const epochDay = parseFloat(line1.substring(20, 32).trim());

    // First derivative of mean motion (revs/day²)
    const ndot = parseFloat(line1.substring(33, 43).trim());

    // BSTAR drag term (pseudo-scientific notation)
    const bstarStr = line1.substring(53, 61).trim();
    const bstar = parseScientific(bstarStr);

    // Line 2 fields
    const inclination = parseFloat(line2.substring(8, 16).trim());
    const raan = parseFloat(line2.substring(17, 25).trim());
    const eccStr = '0.' + line2.substring(26, 33).trim();
    const eccentricity = parseFloat(eccStr);
    const argPerigee = parseFloat(line2.substring(34, 42).trim());
    const meanAnomaly = parseFloat(line2.substring(43, 51).trim());
    const meanMotion = parseFloat(line2.substring(52, 63).trim());

    if (isNaN(noradId) || isNaN(meanMotion) || isNaN(inclination)) return null;

    return {
      noradId, intlDesignator, epochYear, epochDay, ndot, bstar,
      inclination, raan, eccentricity, argPerigee, meanAnomaly, meanMotion,
    };
  } catch {
    return null;
  }
}

function parseScientific(s: string): number {
  // Space-Track format: " 12345-6" means 0.12345e-6
  if (!s || s.trim() === '00000-0' || s.trim() === '00000+0') return 0;
  const match = s.trim().match(/^([+-]?)(\d+)([+-]\d+)$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const mantissa = parseFloat('0.' + match[2]);
  const exponent = parseInt(match[3], 10);
  return sign * mantissa * Math.pow(10, exponent);
}

function epochToDate(year: number, day: number): Date {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setTime(d.getTime() + (day - 1) * 86400000);
  return d;
}

function epochToValue(year: number, day: number): number {
  // Match computeEpochValue format: YYDDD.fractional
  const yy = year % 100;
  return yy * 1000 + day;
}

// ── Process ──────────────────────────────────────────────────────────

function processTle(tle: ParsedTle, now: Date): TleSnapshotRow | null {
  const altitudeKm = altitudeFromMeanMotion(tle.meanMotion, tle.eccentricity);
  if (altitudeKm < 0 || altitudeKm > 2000) return null;

  const epochDate = epochToDate(tle.epochYear, tle.epochDay);
  const epochAgeHours = (now.getTime() - epochDate.getTime()) / (1000 * 3600);

  // Parse international designator for launch year/number
  const intlMatch = tle.intlDesignator.match(/^(\d{2})(\d{3})/);
  if (!intlMatch) return null;
  const launchYr = parseInt(intlMatch[1], 10);
  const launchYear = launchYr >= 57 ? 1900 + launchYr : 2000 + launchYr;
  const launchNumber = parseInt(intlMatch[2], 10);

  const shellId = getShellId(tle.inclination);

  const recentAltitudes = getRecentAltitudes(tle.noradId);
  const altitudeHistory = recentAltitudes.map((r) => r.altitude_km);
  const altitudeTimestamps = recentAltitudes.map((r) => r.epoch_ts);

  const status = classifySatelliteStatus({
    inclination: tle.inclination,
    altitudeKm,
    eccentricity: tle.eccentricity,
    epochAgeHours,
    altitudeHistory: [...altitudeHistory, altitudeKm],
    altitudeTimestamps: [...altitudeTimestamps, Math.floor(epochDate.getTime() / 1000)],
  });

  const islCapable = isISLCapable(tle.inclination, launchYear);

  return {
    norad_id: tle.noradId,
    epoch: epochToValue(tle.epochYear, tle.epochDay),
    epoch_ts: Math.floor(epochDate.getTime() / 1000),
    name: `STARLINK-${tle.noradId}`, // Name not in raw TLE; use NORAD ID placeholder
    inclination: tle.inclination,
    raan: tle.raan,
    eccentricity: tle.eccentricity,
    mean_motion: tle.meanMotion,
    ndot: tle.ndot,
    altitude_km: Math.round(altitudeKm * 100) / 100,
    launch_year: launchYear,
    launch_number: launchNumber,
    shell_id: shellId,
    status,
    is_isl_capable: islCapable ? 1 : 0,
    epoch_age_hours: Math.round(epochAgeHours * 100) / 100,
  };
}

// ── Stream processing ────────────────────────────────────────────────

async function processZipFile(
  zipPath: string,
  knownIds: Set<number>,
  now: Date,
): Promise<{ fetched: number; inserted: number; dates: Set<string> }> {
  // Detect the actual filename inside the zip (may be nested in subdirectories)
  const listOutput = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf-8' });
  const listLines = listOutput.split('\n').filter((l) => !l.includes('__MACOSX'));
  const txtMatch = listLines.join('\n').match(/(\S*tle\d{4}\.txt)\s*$/m);
  const txtName = txtMatch ? txtMatch[1].trim() : (
    zipPath.endsWith('.txt.zip')
      ? path.basename(zipPath, '.txt.zip') + '.txt'
      : path.basename(zipPath, '.zip') + '.txt'
  );

  console.log(`  Streaming ${txtName}...`);

  const db = getDatabase();
  const affectedDates = new Set<string>();
  let fetched = 0;
  let inserted = 0;
  let batchRows: TleSnapshotRow[] = [];
  const BATCH_SIZE = 10000;

  const flushBatch = () => {
    if (batchRows.length === 0) return;
    const txn = db.transaction(() => {
      for (const row of batchRows) {
        insertTleSnapshot(row);
      }
    });
    txn();
    batchRows = [];
  };

  return new Promise((resolve, reject) => {
    const proc = spawn('unzip', ['-p', zipPath, txtName]);
    const rl = createInterface({ input: proc.stdout });

    let prevLine: string | null = null;
    let lineCount = 0;

    rl.on('line', (line) => {
      lineCount++;
      if (prevLine === null) {
        // Waiting for line 1
        if (line.startsWith('1 ')) {
          prevLine = line;
        }
        return;
      }

      // We have line 1, this should be line 2
      if (!line.startsWith('2 ')) {
        // Misaligned — try this line as new line 1
        prevLine = line.startsWith('1 ') ? line : null;
        return;
      }

      const line1 = prevLine;
      const line2 = line;
      prevLine = null;

      // Quick filter by NORAD ID before full parse
      const noradId = parseInt(line1.substring(2, 7).trim(), 10);
      if (!knownIds.has(noradId)) return;

      fetched++;
      const tle = parseTlePair(line1, line2);
      if (!tle) return;

      const row = processTle(tle, now);
      if (!row) return;

      batchRows.push(row);
      const epochDate = epochToDate(tle.epochYear, tle.epochDay);
      affectedDates.add(epochDate.toISOString().split('T')[0]);
      inserted++;

      if (batchRows.length >= BATCH_SIZE) {
        flushBatch();
        if (inserted % 100000 < BATCH_SIZE) {
          console.log(`    ${inserted.toLocaleString()} Starlink records inserted (${lineCount.toLocaleString()} lines scanned)...`);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('__MACOSX')) console.error(`  unzip: ${msg}`);
    });

    rl.on('close', () => {
      flushBatch();
      resolve({ fetched, inserted, dates: affectedDates });
    });

    proc.on('error', reject);
  });
}

// ── Fix names from DB ────────────────────────────────────────────────

function loadNameMap(): Map<number, string> {
  const db = getDatabase();
  const rows = db.prepare(
    "SELECT DISTINCT norad_id, name FROM tle_snapshots WHERE name LIKE 'STARLINK-%' AND name != ('STARLINK-' || norad_id)"
  ).all() as { norad_id: number; name: string }[];
  const map = new Map<number, string>();
  for (const r of rows) map.set(r.norad_id, r.name);
  return map;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf('--dir');
  const doUpload = args.includes('--upload');
  const bulkDir = dirIdx >= 0 ? args[dirIdx + 1] : path.resolve(__dirname, '../data/bulk');

  // Find zip files in specified dir or ~/Downloads
  let searchDirs = [bulkDir];
  if (!fs.existsSync(bulkDir) || fs.readdirSync(bulkDir).filter((f) => f.includes('tle') && f.endsWith('.zip')).length === 0) {
    const dlDir = path.join(process.env.HOME || '', 'Downloads');
    searchDirs = [dlDir];
  }

  let zipFiles: string[] = [];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const found = fs.readdirSync(dir)
      .filter((f) => f.match(/^tle\d{4}\.txt\.zip$/) || f.match(/^tle\d{4}\.zip$/))
      .sort()
      .map((f) => path.join(dir, f));
    zipFiles.push(...found);
  }

  if (zipFiles.length === 0) {
    console.error('No TLE zip files found.');
    console.error('Download from: https://ln5.sync.com/dl/afd354190/c5cd2q72-a5qjzp4q-nbjdiqkr-cenajuqu');
    console.error('Expected pattern: tle2023.txt.zip');
    process.exit(1);
  }

  console.log('=== Space-Track Bulk TLE Ingestion ===');
  console.log(`  Files: ${zipFiles.map((f) => path.basename(f)).join(', ')}`);
  console.log(`  Database: ${DB_PATH}`);

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  initDatabase(DB_PATH);
  const countBefore = getRecordCount();
  console.log(`  Records before: ${countBefore.toLocaleString()}`);

  // Load known Starlink NORAD IDs from existing DB
  const knownIds = loadStarlinkNoradIds();
  console.log(`  Known Starlink NORAD IDs: ${knownIds.size.toLocaleString()}`);

  if (knownIds.size === 0) {
    console.error('No Starlink satellites in DB. Run the CelesTrak ingestion first (npm run ingest).');
    process.exit(1);
  }

  const now = new Date();
  let totalInserted = 0;
  let totalFetched = 0;
  const allAffectedDates = new Set<string>();

  for (let i = 0; i < zipFiles.length; i++) {
    const zipPath = zipFiles[i];
    const sizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(0);
    console.log(`\n[${i + 1}/${zipFiles.length}] ${path.basename(zipPath)} (${sizeMB} MB)...`);

    const { fetched, inserted, dates } = await processZipFile(zipPath, knownIds, now);
    totalFetched += fetched;
    totalInserted += inserted;
    for (const d of dates) allAffectedDates.add(d);

    console.log(`  Starlink TLEs found: ${fetched.toLocaleString()}`);
    console.log(`  Inserted: ${inserted.toLocaleString()}`);
  }

  // Rebuild daily snapshots
  console.log(`\nRebuilding daily snapshots for ${allAffectedDates.size.toLocaleString()} dates...`);
  const datesSorted = [...allAffectedDates].sort();
  for (let i = 0; i < datesSorted.length; i++) {
    rebuildDailySnapshots(datesSorted[i]);
    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${datesSorted.length} dates rebuilt`);
    }
  }

  const countAfter = getRecordCount();
  console.log('\n=== Summary ===');
  console.log(`  Starlink TLEs: ${totalFetched.toLocaleString()}`);
  console.log(`  Inserted:      ${totalInserted.toLocaleString()}`);
  console.log(`  DB total:      ${countAfter.toLocaleString()} records`);
  console.log(`  DB size:       ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1)} MB`);

  closeDatabase();

  if (doUpload) {
    console.log('\nUploading to HF dataset...');
    execFileSync('hf', ['upload', 'juliensimon/starlink-fleet-data', DB_PATH, 'fleet.db', '--repo-type', 'dataset'], {
      stdio: 'inherit',
    });
    console.log('Uploaded fleet.db to juliensimon/starlink-fleet-data');
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  closeDatabase();
  process.exit(1);
});
