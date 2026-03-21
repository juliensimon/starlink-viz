import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function initDatabase(path: string = 'data/fleet.db'): Database.Database {
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tle_snapshots (
      norad_id INTEGER,
      epoch REAL,
      epoch_ts INTEGER,
      name TEXT,
      inclination REAL,
      raan REAL,
      eccentricity REAL,
      mean_motion REAL,
      ndot REAL,
      altitude_km REAL,
      launch_year INTEGER,
      launch_number INTEGER,
      shell_id INTEGER,
      status TEXT DEFAULT 'unknown',
      is_isl_capable INTEGER DEFAULT 0,
      epoch_age_hours REAL DEFAULT 0,
      PRIMARY KEY (norad_id, epoch_ts)
    );

    CREATE INDEX IF NOT EXISTS idx_epoch_ts ON tle_snapshots(epoch_ts);
    CREATE INDEX IF NOT EXISTS idx_norad_epoch ON tle_snapshots(norad_id, epoch_ts);
    CREATE INDEX IF NOT EXISTS idx_shell_epoch ON tle_snapshots(shell_id, epoch_ts);
    CREATE INDEX IF NOT EXISTS idx_status ON tle_snapshots(status);

    CREATE TABLE IF NOT EXISTS daily_snapshots (
      date TEXT,
      shell_id INTEGER,
      total_count INTEGER,
      operational_count INTEGER,
      raising_count INTEGER,
      deorbiting_count INTEGER,
      reentered_count INTEGER,
      isl_operational_count INTEGER,
      avg_altitude REAL,
      min_altitude REAL,
      max_altitude REAL,
      new_launches INTEGER,
      anomalous_count INTEGER,
      PRIMARY KEY (date, shell_id)
    );
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
