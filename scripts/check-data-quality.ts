/**
 * Data quality checks for the fleet database before HF upload.
 */

import * as path from 'path';
import { initDatabase, closeDatabase, getDatabase } from '../src/lib/fleet/db';

const DB_PATH = path.resolve(__dirname, '../data/fleet.db');

interface Issue {
  severity: 'error' | 'warning';
  check: string;
  message: string;
}

const issues: Issue[] = [];

function check(name: string, fn: () => void) {
  try {
    console.log(`  ${name}...`);
    fn();
  } catch (err) {
    issues.push({ severity: 'error', check: name, message: (err as Error).message });
  }
}

function main() {
  initDatabase(DB_PATH);
  const db = getDatabase();

  console.log('=== Data Quality Checks ===\n');

  // ── 1. Basic counts ──
  check('Record counts', () => {
    const tle = db.prepare('SELECT COUNT(*) as c FROM tle_snapshots').get() as { c: number };
    const daily = db.prepare('SELECT COUNT(*) as c FROM daily_snapshots').get() as { c: number };
    console.log(`    TLE snapshots: ${tle.c.toLocaleString()}`);
    console.log(`    Daily snapshots: ${daily.c.toLocaleString()}`);
    if (tle.c < 10_000_000) issues.push({ severity: 'warning', check: 'Record counts', message: `Only ${tle.c.toLocaleString()} TLE records — expected 15M+` });
    if (daily.c < 5000) issues.push({ severity: 'warning', check: 'Record counts', message: `Only ${daily.c} daily snapshots — expected 8000+` });
  });

  // ── 2. Date range coverage ──
  check('Date range', () => {
    const range = db.prepare(`
      SELECT
        date(MIN(epoch_ts), 'unixepoch') as min_date,
        date(MAX(epoch_ts), 'unixepoch') as max_date
      FROM tle_snapshots
    `).get() as { min_date: string; max_date: string };
    console.log(`    TLE range: ${range.min_date} → ${range.max_date}`);
    if (range.min_date > '2019-06-01') issues.push({ severity: 'error', check: 'Date range', message: `Earliest date is ${range.min_date}, expected May 2019` });
    if (range.max_date < '2025-01-01') issues.push({ severity: 'error', check: 'Date range', message: `Latest date is ${range.max_date}, expected 2025+` });
  });

  // ── 3. Year-by-year record counts ──
  check('Yearly distribution', () => {
    const rows = db.prepare(`
      SELECT
        CAST(strftime('%Y', epoch_ts, 'unixepoch') AS INTEGER) as year,
        COUNT(*) as c,
        COUNT(DISTINCT norad_id) as sats
      FROM tle_snapshots
      GROUP BY year ORDER BY year
    `).all() as { year: number; c: number; sats: number }[];
    for (const r of rows) {
      console.log(`    ${r.year}: ${r.c.toLocaleString()} records, ${r.sats.toLocaleString()} satellites`);
    }
    // Check for year gaps
    const years = rows.map((r) => r.year);
    for (let y = years[0]; y <= years[years.length - 1]; y++) {
      if (!years.includes(y)) {
        issues.push({ severity: 'error', check: 'Yearly distribution', message: `Missing year: ${y}` });
      }
    }
  });

  // ── 4. Monthly gaps ──
  check('Monthly coverage gaps', () => {
    const rows = db.prepare(`
      SELECT
        strftime('%Y-%m', epoch_ts, 'unixepoch') as month,
        COUNT(*) as c
      FROM tle_snapshots
      GROUP BY month ORDER BY month
    `).all() as { month: string; c: number }[];

    // Check for missing months
    const months = new Set(rows.map((r) => r.month));
    const first = rows[0].month;
    const last = rows[rows.length - 1].month;
    const [fy, fm] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    let y = fy, m = fm;
    const gaps: string[] = [];
    while (y < ly || (y === ly && m <= lm)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!months.has(key)) gaps.push(key);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    if (gaps.length > 0) {
      console.log(`    Gaps: ${gaps.join(', ')}`);
      issues.push({ severity: 'error', check: 'Monthly gaps', message: `Missing months: ${gaps.join(', ')}` });
    } else {
      console.log(`    No monthly gaps (${first} → ${last})`);
    }

    // Check for suspiciously low months
    for (const r of rows) {
      if (r.c < 1000 && r.month > '2019-06') {
        issues.push({ severity: 'warning', check: 'Monthly coverage', message: `${r.month} has only ${r.c} records` });
      }
    }
  });

  // ── 5. Placeholder names ──
  check('Satellite names', () => {
    const placeholder = db.prepare(`
      SELECT COUNT(DISTINCT norad_id) as c FROM tle_snapshots
      WHERE name = 'STARLINK-' || norad_id
    `).get() as { c: number };
    const total = db.prepare('SELECT COUNT(DISTINCT norad_id) as c FROM tle_snapshots').get() as { c: number };
    const real = db.prepare(`
      SELECT COUNT(DISTINCT norad_id) as c FROM tle_snapshots
      WHERE name LIKE 'STARLINK-%' AND name != 'STARLINK-' || norad_id
    `).get() as { c: number };
    console.log(`    Total satellites: ${total.c.toLocaleString()}`);
    console.log(`    With real names: ${real.c.toLocaleString()}`);
    console.log(`    With placeholder names (STARLINK-{noradId}): ${placeholder.c.toLocaleString()}`);
    if (placeholder.c > 0) {
      issues.push({ severity: 'warning', check: 'Names', message: `${placeholder.c} satellites have placeholder names from bulk TLE import` });
    }
  });

  // ── 6. Status distribution ──
  check('Status distribution', () => {
    const rows = db.prepare(`
      SELECT status, COUNT(*) as c FROM tle_snapshots GROUP BY status ORDER BY c DESC
    `).all() as { status: string; c: number }[];
    for (const r of rows) {
      console.log(`    ${r.status}: ${r.c.toLocaleString()}`);
    }
    const unknownPct = (rows.find((r) => r.status === 'unknown')?.c || 0) / rows.reduce((a, r) => a + r.c, 0) * 100;
    if (unknownPct > 50) {
      issues.push({ severity: 'warning', check: 'Status', message: `${unknownPct.toFixed(1)}% of records have unknown status` });
    }
  });

  // ── 7. Shell distribution ──
  check('Shell distribution', () => {
    const rows = db.prepare(`
      SELECT shell_id, COUNT(*) as c, COUNT(DISTINCT norad_id) as sats
      FROM tle_snapshots GROUP BY shell_id ORDER BY shell_id
    `).all() as { shell_id: number; c: number; sats: number }[];
    for (const r of rows) {
      console.log(`    Shell ${r.shell_id}: ${r.c.toLocaleString()} records, ${r.sats} satellites`);
    }
  });

  // ── 8. Daily snapshot coverage ──
  check('Daily snapshot completeness', () => {
    const range = db.prepare(`
      SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(DISTINCT date) as days
      FROM daily_snapshots
    `).get() as { min_date: string; max_date: string; days: number };
    console.log(`    Range: ${range.min_date} → ${range.max_date} (${range.days} days)`);

    // Check for dates with suspiciously low total counts
    const low = db.prepare(`
      SELECT date, SUM(total_count) as total FROM daily_snapshots
      GROUP BY date HAVING total < 10 AND date > '2019-12-01'
      ORDER BY date LIMIT 10
    `).all() as { date: string; total: number }[];
    if (low.length > 0) {
      console.log(`    Low-count dates: ${low.map((r) => `${r.date}(${r.total})`).join(', ')}`);
      issues.push({ severity: 'warning', check: 'Daily snapshots', message: `${low.length} dates with <10 satellites` });
    }
  });

  // ── 9. Altitude sanity ──
  check('Altitude sanity', () => {
    const bad = db.prepare(`
      SELECT COUNT(*) as c FROM tle_snapshots WHERE altitude_km < 0 OR altitude_km > 2000
    `).get() as { c: number };
    console.log(`    Out-of-range altitudes: ${bad.c}`);
    if (bad.c > 0) issues.push({ severity: 'error', check: 'Altitude', message: `${bad.c} records with altitude <0 or >2000 km` });
  });

  // ── 10. Duplicate check ──
  check('Duplicates', () => {
    const dupes = db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT norad_id, epoch_ts, COUNT(*) as cnt FROM tle_snapshots
        GROUP BY norad_id, epoch_ts HAVING cnt > 1
      )
    `).get() as { c: number };
    console.log(`    Duplicate (norad_id, epoch_ts) pairs: ${dupes.c}`);
    if (dupes.c > 0) issues.push({ severity: 'warning', check: 'Duplicates', message: `${dupes.c} duplicate entries` });
  });

  // ── Summary ──
  console.log('\n=== Summary ===');
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  if (errors.length > 0) {
    console.log(`\n  ERRORS (${errors.length}):`);
    for (const e of errors) console.log(`    ❌ [${e.check}] ${e.message}`);
  }
  if (warnings.length > 0) {
    console.log(`\n  WARNINGS (${warnings.length}):`);
    for (const w of warnings) console.log(`    ⚠️  [${w.check}] ${w.message}`);
  }
  if (errors.length === 0 && warnings.length === 0) {
    console.log('  ✅ All checks passed!');
  }

  closeDatabase();
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
