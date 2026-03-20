import { getDatabase } from './db';

export interface TleSnapshotRow {
  norad_id: number;
  epoch: number;
  epoch_ts: number;
  name: string;
  inclination: number;
  raan: number;
  eccentricity: number;
  mean_motion: number;
  ndot: number;
  altitude_km: number;
  launch_year: number;
  launch_number: number;
  shell_id: number;
  status: string;
  is_isl_capable: number;
  epoch_age_hours: number;
}

export interface DailySnapshotRow {
  date: string;
  shell_id: number;
  total_count: number;
  operational_count: number;
  raising_count: number;
  deorbiting_count: number;
  reentered_count: number;
  isl_operational_count: number;
  avg_altitude: number;
  min_altitude: number;
  max_altitude: number;
  new_launches: number;
  anomalous_count: number;
}

export function insertTleSnapshot(row: TleSnapshotRow): void {
  const db = getDatabase();
  db.prepare(`INSERT OR IGNORE INTO tle_snapshots (
    norad_id, epoch, epoch_ts, name, inclination, raan, eccentricity,
    mean_motion, ndot, altitude_km, launch_year, launch_number,
    shell_id, status, is_isl_capable, epoch_age_hours
  ) VALUES (
    @norad_id, @epoch, @epoch_ts, @name, @inclination, @raan, @eccentricity,
    @mean_motion, @ndot, @altitude_km, @launch_year, @launch_number,
    @shell_id, @status, @is_isl_capable, @epoch_age_hours
  )`).run(row);
}

export function getRecentAltitudes(
  noradId: number,
  limit = 5
): { altitude_km: number; epoch_ts: number }[] {
  const db = getDatabase();
  return db
    .prepare(
      'SELECT altitude_km, epoch_ts FROM tle_snapshots WHERE norad_id = ? ORDER BY epoch_ts DESC LIMIT ?'
    )
    .all(noradId, limit) as { altitude_km: number; epoch_ts: number }[];
}

export function rebuildDailySnapshots(date: string): void {
  const db = getDatabase();

  db.prepare('DELETE FROM daily_snapshots WHERE date = ?').run(date);

  db.prepare(`
    INSERT INTO daily_snapshots (
      date, shell_id, total_count, operational_count, raising_count,
      deorbiting_count, reentered_count, isl_operational_count,
      avg_altitude, min_altitude, max_altitude, new_launches, anomalous_count
    )
    SELECT
      ? AS date,
      latest.shell_id,
      COUNT(*) AS total_count,
      SUM(CASE WHEN latest.status = 'operational' THEN 1 ELSE 0 END) AS operational_count,
      SUM(CASE WHEN latest.status = 'raising' THEN 1 ELSE 0 END) AS raising_count,
      SUM(CASE WHEN latest.status = 'deorbiting' THEN 1 ELSE 0 END) AS deorbiting_count,
      SUM(CASE WHEN latest.status = 'decayed' THEN 1 ELSE 0 END) AS reentered_count,
      SUM(CASE WHEN latest.status = 'operational' AND latest.is_isl_capable = 1 THEN 1 ELSE 0 END) AS isl_operational_count,
      AVG(latest.altitude_km) AS avg_altitude,
      MIN(latest.altitude_km) AS min_altitude,
      MAX(latest.altitude_km) AS max_altitude,
      SUM(CASE WHEN first_seen.first_ts = latest.epoch_ts THEN 1 ELSE 0 END) AS new_launches,
      SUM(CASE WHEN latest.status = 'anomalous' THEN 1 ELSE 0 END) AS anomalous_count
    FROM (
      SELECT t.*
      FROM tle_snapshots t
      INNER JOIN (
        SELECT norad_id, MAX(epoch_ts) AS max_ts
        FROM tle_snapshots
        WHERE date(epoch_ts, 'unixepoch') <= ?
        GROUP BY norad_id
      ) m ON t.norad_id = m.norad_id AND t.epoch_ts = m.max_ts
    ) latest
    LEFT JOIN (
      SELECT norad_id, MIN(epoch_ts) AS first_ts
      FROM tle_snapshots
      WHERE date(epoch_ts, 'unixepoch') <= ?
      GROUP BY norad_id
    ) first_seen ON latest.norad_id = first_seen.norad_id
    WHERE latest.status != 'decayed'
    GROUP BY latest.shell_id
  `).run(date, date, date);
}

export function queryGrowth(from?: string, to?: string): DailySnapshotRow[] {
  const db = getDatabase();
  let sql = 'SELECT * FROM daily_snapshots';
  const params: string[] = [];

  if (from && to) {
    sql += ' WHERE date >= ? AND date <= ?';
    params.push(from, to);
  } else if (from) {
    sql += ' WHERE date >= ?';
    params.push(from);
  } else if (to) {
    sql += ' WHERE date <= ?';
    params.push(to);
  }

  sql += ' ORDER BY date, shell_id';
  return db.prepare(sql).all(...params) as DailySnapshotRow[];
}

export function queryShells(): DailySnapshotRow[] {
  const db = getDatabase();
  return db
    .prepare(
      'SELECT * FROM daily_snapshots WHERE date = (SELECT MAX(date) FROM daily_snapshots)'
    )
    .all() as DailySnapshotRow[];
}

export function queryLaunches(from?: string, to?: string): DailySnapshotRow[] {
  const db = getDatabase();
  let sql = 'SELECT * FROM daily_snapshots WHERE new_launches > 0';
  const params: string[] = [];

  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }

  sql += ' ORDER BY date, shell_id';
  return db.prepare(sql).all(...params) as DailySnapshotRow[];
}

export function querySatelliteHistory(
  noradId: number,
  limit = 1000
): TleSnapshotRow[] {
  const db = getDatabase();
  return db
    .prepare(
      'SELECT * FROM tle_snapshots WHERE norad_id = ? ORDER BY epoch_ts LIMIT ?'
    )
    .all(noradId, limit) as TleSnapshotRow[];
}

export function queryAltitudes(date?: string): TleSnapshotRow[] {
  const db = getDatabase();
  // Latest snapshot per satellite, exclude decayed
  return db
    .prepare(`
      SELECT t.*
      FROM tle_snapshots t
      INNER JOIN (
        SELECT norad_id, MAX(epoch_ts) AS max_ts
        FROM tle_snapshots
        GROUP BY norad_id
      ) m ON t.norad_id = m.norad_id AND t.epoch_ts = m.max_ts
      WHERE t.status != 'decayed'
      ORDER BY t.norad_id
    `)
    .all() as TleSnapshotRow[];
}

export function queryPlanes(shellId: number): TleSnapshotRow[] {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT t.*
      FROM tle_snapshots t
      INNER JOIN (
        SELECT norad_id, MAX(epoch_ts) AS max_ts
        FROM tle_snapshots
        WHERE shell_id = ?
        GROUP BY norad_id
      ) m ON t.norad_id = m.norad_id AND t.epoch_ts = m.max_ts
      ORDER BY t.raan
    `)
    .all(shellId) as TleSnapshotRow[];
}

export function getRecordCount(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM tle_snapshots').get() as {
    cnt: number;
  };
  return row.cnt;
}

export function getLastIngestDate(): string | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT MAX(date) AS max_date FROM daily_snapshots')
    .get() as { max_date: string | null };
  return row.max_date;
}
