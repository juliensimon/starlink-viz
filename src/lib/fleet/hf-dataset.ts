/**
 * Reads fleet data from local Parquet files (downloaded HF dataset) via DuckDB.
 *
 * Local path: data/dataset/data/*.parquet
 * Refresh: POST /api/fleet/refresh re-downloads from HF
 */

import { DuckDBInstance } from '@duckdb/node-api';
import { existsSync } from 'fs';
import { join } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────

const DATASET_DIR = join(process.cwd(), 'data/dataset/data');
const DAILY_PATH = join(DATASET_DIR, 'daily_snapshots.parquet');
const TLE_PATH = join(DATASET_DIR, 'tle_snapshots.parquet');
const LATEST_PATH = join(DATASET_DIR, 'latest_satellites.parquet');

// ── DuckDB connection (singleton) ──────────────────────────────────────

let dbPromise: Promise<DuckDBInstance> | null = null;

async function getDb(): Promise<DuckDBInstance> {
  if (!dbPromise) {
    dbPromise = DuckDBInstance.create();
  }
  return dbPromise;
}

async function query<T>(sql: string): Promise<T[]> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const result = await conn.run(sql);
    const rows: T[] = [];
    for (let c = 0; c < result.chunkCount; c++) {
      const chunk = result.getChunk(c);
      const raw = chunk.getRows();
      // Build objects from column names
      const names: string[] = [];
      for (let i = 0; i < result.columnCount; i++) {
        names.push(result.columnName(i));
      }
      for (const row of raw) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < names.length; i++) {
          let val = row[i];
          // Convert BigInt to number (DuckDB returns BIGINT for COUNT/SUM)
          if (typeof val === 'bigint') val = Number(val);
          // Convert DuckDB timestamp objects to ISO string
          else if (val && typeof val === 'object' && 'micros' in val) {
            val = new Date(Number(BigInt((val as { micros: bigint }).micros) / BigInt(1000))).toISOString();
          }
          else if (val && typeof val === 'object' && 'nanos' in val) {
            val = new Date(Number(BigInt((val as { nanos: bigint }).nanos) / BigInt(1000000))).toISOString();
          }
          // Convert any nested BigInts (e.g. in structs)
          else if (val && typeof val === 'object') {
            val = JSON.parse(JSON.stringify(val, (_, v) => typeof v === 'bigint' ? Number(v) : v));
          }
          obj[names[i]] = val;
        }
        rows.push(obj as T);
      }
    }
    return rows;
  } finally {
    conn.disconnectSync();
  }
}

// ── Input validation ───────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function validateDate(d: string | undefined): string | undefined {
  if (!d) return undefined;
  if (!ISO_DATE_RE.test(d)) return undefined;
  return d.slice(0, 10); // only keep YYYY-MM-DD
}

function sanitizeSearchQuery(q: string): string {
  // Strip everything except alphanumeric, dash, space
  return q.replace(/[^a-zA-Z0-9\- ]/g, '').slice(0, 50);
}

// ── Public API ─────────────────────────────────────────────────────────

/** Clear DuckDB connection — forces fresh reads on next query */
export async function clearCache(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.closeSync();
    } catch { /* ignore */ }
  }
  dbPromise = null;
}

export async function getShellsSummary() {
  if (!existsSync(DAILY_PATH)) return { shells: [], recordCount: 0, lastIngest: null };

  const shells = await query<Record<string, unknown>>(`
    WITH latest AS (SELECT MAX(date) as d FROM read_parquet('${DAILY_PATH}'))
    SELECT * FROM read_parquet('${DAILY_PATH}')
    WHERE date = (SELECT d FROM latest)
  `);

  const stats = await query<{ cnt: number; last: string }>(`
    SELECT COUNT(DISTINCT date) as cnt, MAX(date) as last
    FROM read_parquet('${DAILY_PATH}')
  `);

  return {
    shells,
    recordCount: stats[0]?.cnt ?? 0,
    lastIngest: stats[0]?.last ?? null,
  };
}

export async function getGrowthData(from?: string, to?: string) {
  if (!existsSync(DAILY_PATH)) return [];

  const safeFrom = validateDate(from);
  const safeTo = validateDate(to);
  const where: string[] = [];
  if (safeFrom) where.push(`date >= '${safeFrom}'`);
  if (safeTo) where.push(`date <= '${safeTo}'`);
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  return query(`
    SELECT date, shell_id, operational_count, total_count,
           raising_count, deorbiting_count, isl_operational_count
    FROM read_parquet('${DAILY_PATH}')
    ${whereClause}
    ORDER BY date, shell_id
  `);
}

export async function getLaunchData(from?: string, to?: string) {
  if (!existsSync(DAILY_PATH)) return [];

  const safeFrom = validateDate(from);
  const safeTo = validateDate(to);
  const where: string[] = [];
  if (safeFrom) where.push(`date >= '${safeFrom}'`);
  if (safeTo) where.push(`date <= '${safeTo}'`);
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  return query(`
    SELECT date, SUM(new_launches) as new_launches
    FROM read_parquet('${DAILY_PATH}')
    ${whereClause}
    GROUP BY date
    ORDER BY date
  `);
}

export async function getAltitudeData(_date?: string) {
  if (existsSync(LATEST_PATH)) {
    return query(`
      SELECT norad_id, altitude_km, shell_id, status
      FROM read_parquet('${LATEST_PATH}')
    `);
  }
  return [];
}

export async function getPlaneData(shellId: number) {
  // Use latest_satellites (pre-computed latest per sat) — much faster than scanning tle_snapshots
  if (existsSync(LATEST_PATH)) {
    return query(`
      SELECT raan, altitude_km, mean_motion, inclination, epoch_ts
      FROM read_parquet('${LATEST_PATH}')
      WHERE shell_id = ${shellId}
    `);
  }
  return [];
}

export async function getKpis() {
  const result: Record<string, number> = {
    total: 0, operational: 0, islCapable: 0, raising: 0, deorbiting: 0, decayed: 0, launched2026: 0,
  };

  if (!existsSync(DAILY_PATH)) return result;

  const rows = await query<Record<string, number>>(`
    WITH latest AS (SELECT MAX(date) as d FROM read_parquet('${DAILY_PATH}'))
    SELECT SUM(total_count) as total, SUM(operational_count) as operational,
           SUM(isl_operational_count) as isl_capable,
           SUM(raising_count) as raising, SUM(deorbiting_count) as deorbiting
    FROM read_parquet('${DAILY_PATH}') WHERE date = (SELECT d FROM latest)
  `);
  if (rows[0]) {
    result.total = rows[0].total ?? 0;
    result.operational = rows[0].operational ?? 0;
    result.islCapable = rows[0].isl_capable ?? 0;
    result.raising = rows[0].raising ?? 0;
    result.deorbiting = rows[0].deorbiting ?? 0;
  }

  return result;
}

export async function getVintageData() {
  if (!existsSync(LATEST_PATH)) return [];
  return query(`
    SELECT launch_year, status, COUNT(*) as count
    FROM read_parquet('${LATEST_PATH}')
    GROUP BY launch_year, status
    ORDER BY launch_year, status
  `);
}

export async function searchSatellites(q: string, limit = 20) {
  if (!existsSync(LATEST_PATH)) return [];
  const safe = sanitizeSearchQuery(q);
  if (safe.length < 2) return [];

  const isNumeric = /^\d+$/.test(safe);
  const where = isNumeric
    ? `norad_id = ${parseInt(safe)}`
    : `name ILIKE '%${safe}%'`;
  return query(`
    SELECT norad_id, name, status, altitude_km, shell_id, launch_year
    FROM read_parquet('${LATEST_PATH}')
    WHERE ${where}
    ORDER BY name
    LIMIT ${limit}
  `);
}

export async function getSatelliteHistory(noradId: number) {
  if (!existsSync(TLE_PATH)) return [];

  return query(`
    SELECT epoch_utc, altitude_km, status
    FROM read_parquet('${TLE_PATH}')
    WHERE norad_id = ${noradId}
    ORDER BY epoch_utc
  `);
}
