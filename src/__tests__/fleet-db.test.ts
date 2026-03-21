import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, getDatabase, closeDatabase } from '@/lib/fleet/db';

describe('fleet database layer', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  it('sets WAL journal mode', () => {
    // :memory: databases report 'memory' for journal_mode even when WAL is set.
    // Verify by using a temp file database instead.
    closeDatabase();
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const tmpPath = path.join(os.tmpdir(), `fleet-test-${Date.now()}.db`);
    try {
      initDatabase(tmpPath);
      const db = getDatabase();
      const row = db.pragma('journal_mode', { simple: true }) as string;
      expect(row).toBe('wal');
    } finally {
      closeDatabase();
      try { fs.unlinkSync(tmpPath); } catch {}
      try { fs.unlinkSync(tmpPath + '-wal'); } catch {}
      try { fs.unlinkSync(tmpPath + '-shm'); } catch {}
      // Re-init in-memory for remaining tests
      initDatabase(':memory:');
    }
  });

  it('creates tle_snapshots table with correct columns', () => {
    const db = getDatabase();
    const cols = db
      .prepare("PRAGMA table_info(tle_snapshots)")
      .all() as { name: string; type: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain('norad_id');
    expect(names).toContain('epoch');
    expect(names).toContain('epoch_ts');
    expect(names).toContain('name');
    expect(names).toContain('inclination');
    expect(names).toContain('raan');
    expect(names).toContain('eccentricity');
    expect(names).toContain('mean_motion');
    expect(names).toContain('ndot');
    expect(names).toContain('altitude_km');
    expect(names).toContain('launch_year');
    expect(names).toContain('launch_number');
    expect(names).toContain('shell_id');
    expect(names).toContain('status');
    expect(names).toContain('is_isl_capable');
    expect(names).toContain('epoch_age_hours');
  });

  it('creates daily_snapshots table with correct columns', () => {
    const db = getDatabase();
    const cols = db
      .prepare("PRAGMA table_info(daily_snapshots)")
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain('date');
    expect(names).toContain('shell_id');
    expect(names).toContain('total_count');
    expect(names).toContain('operational_count');
    expect(names).toContain('raising_count');
    expect(names).toContain('deorbiting_count');
    expect(names).toContain('reentered_count');
    expect(names).toContain('isl_operational_count');
    expect(names).toContain('avg_altitude');
    expect(names).toContain('min_altitude');
    expect(names).toContain('max_altitude');
    expect(names).toContain('new_launches');
    expect(names).toContain('anomalous_count');
  });

  it('creates expected indexes on tle_snapshots', () => {
    const db = getDatabase();
    const indexes = db
      .prepare("PRAGMA index_list(tle_snapshots)")
      .all() as { name: string }[];
    const names = indexes.map((i) => i.name);
    expect(names).toContain('idx_epoch_ts');
    expect(names).toContain('idx_norad_epoch');
    expect(names).toContain('idx_shell_epoch');
    expect(names).toContain('idx_status');
  });

  it('can insert and retrieve a tle_snapshot row', () => {
    const db = getDatabase();
    db.prepare(`INSERT INTO tle_snapshots (
      norad_id, epoch, epoch_ts, name, inclination, raan, eccentricity,
      mean_motion, ndot, altitude_km, launch_year, launch_number,
      shell_id, status, is_isl_capable, epoch_age_hours
    ) VALUES (
      @norad_id, @epoch, @epoch_ts, @name, @inclination, @raan, @eccentricity,
      @mean_motion, @ndot, @altitude_km, @launch_year, @launch_number,
      @shell_id, @status, @is_isl_capable, @epoch_age_hours
    )`).run({
      norad_id: 44713,
      epoch: 2026.5,
      epoch_ts: 1700000000,
      name: 'STARLINK-1007',
      inclination: 53.0,
      raan: 120.5,
      eccentricity: 0.0001,
      mean_motion: 15.06,
      ndot: 0.0001,
      altitude_km: 550,
      launch_year: 2019,
      launch_number: 74,
      shell_id: 2,
      status: 'operational',
      is_isl_capable: 0,
      epoch_age_hours: 2.5,
    });

    const row = db
      .prepare('SELECT * FROM tle_snapshots WHERE norad_id = 44713')
      .get() as Record<string, unknown>;
    expect(row.name).toBe('STARLINK-1007');
    expect(row.altitude_km).toBe(550);
  });

  it('enforces primary key uniqueness with INSERT OR IGNORE', () => {
    const db = getDatabase();
    const stmt = db.prepare(`INSERT OR IGNORE INTO tle_snapshots (
      norad_id, epoch, epoch_ts, name, inclination, raan, eccentricity,
      mean_motion, ndot, altitude_km, launch_year, launch_number,
      shell_id, status, is_isl_capable, epoch_age_hours
    ) VALUES (
      @norad_id, @epoch, @epoch_ts, @name, @inclination, @raan, @eccentricity,
      @mean_motion, @ndot, @altitude_km, @launch_year, @launch_number,
      @shell_id, @status, @is_isl_capable, @epoch_age_hours
    )`);

    const params = {
      norad_id: 44713,
      epoch: 2026.5,
      epoch_ts: 1700000000,
      name: 'STARLINK-1007',
      inclination: 53.0,
      raan: 120.5,
      eccentricity: 0.0001,
      mean_motion: 15.06,
      ndot: 0.0001,
      altitude_km: 550,
      launch_year: 2019,
      launch_number: 74,
      shell_id: 2,
      status: 'operational',
      is_isl_capable: 0,
      epoch_age_hours: 2.5,
    };

    stmt.run(params);
    // Same PK (norad_id, epoch_ts), different name — should be ignored
    stmt.run({ ...params, name: 'DIFFERENT' });

    const count = db
      .prepare('SELECT COUNT(*) as cnt FROM tle_snapshots WHERE norad_id = 44713')
      .get() as { cnt: number };
    expect(count.cnt).toBe(1);

    const row = db
      .prepare('SELECT name FROM tle_snapshots WHERE norad_id = 44713')
      .get() as { name: string };
    expect(row.name).toBe('STARLINK-1007');
  });
});
