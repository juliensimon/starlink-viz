import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '@/lib/fleet/db';
import {
  insertTleSnapshot,
  getRecentAltitudes,
  rebuildDailySnapshots,
  queryGrowth,
  queryShells,
  queryLaunches,
  querySatelliteHistory,
  getRecordCount,
  getLastIngestDate,
  type TleSnapshotRow,
} from '@/lib/fleet/queries';

function makeSat(overrides: Partial<TleSnapshotRow>): TleSnapshotRow {
  return {
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
    ...overrides,
  };
}

describe('fleet query functions', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  it('insertTleSnapshot and getRecordCount', () => {
    insertTleSnapshot(makeSat({}));
    expect(getRecordCount()).toBe(1);
  });

  it('INSERT OR IGNORE on duplicate PK', () => {
    insertTleSnapshot(makeSat({}));
    insertTleSnapshot(makeSat({ name: 'DIFFERENT' }));
    expect(getRecordCount()).toBe(1);
  });

  it('getRecentAltitudes returns ordered altitudes', () => {
    insertTleSnapshot(makeSat({ epoch_ts: 1000, altitude_km: 300 }));
    insertTleSnapshot(makeSat({ epoch_ts: 2000, altitude_km: 400 }));
    insertTleSnapshot(makeSat({ epoch_ts: 3000, altitude_km: 500 }));

    const alts = getRecentAltitudes(44713, 3);
    // Ordered by epoch_ts DESC → most recent first
    expect(alts.map((a) => a.altitude_km)).toEqual([500, 400, 300]);
  });

  describe('daily snapshots', () => {
    beforeEach(() => {
      // Day 1: 2 sats in shell 2, 1 sat in shell 3
      // Sat A: shell 2, operational
      insertTleSnapshot(
        makeSat({
          norad_id: 100,
          epoch_ts: 1000,
          shell_id: 2,
          status: 'operational',
          altitude_km: 550,
          inclination: 53,
          launch_year: 2020,
        })
      );
      // Sat B: shell 2, raising
      insertTleSnapshot(
        makeSat({
          norad_id: 101,
          epoch_ts: 1001,
          shell_id: 2,
          status: 'raising',
          altitude_km: 400,
          inclination: 53,
          launch_year: 2020,
        })
      );
      // Sat C: shell 3, operational
      insertTleSnapshot(
        makeSat({
          norad_id: 102,
          epoch_ts: 1002,
          shell_id: 3,
          status: 'operational',
          altitude_km: 570,
          inclination: 70,
          launch_year: 2021,
        })
      );

      // Day 2: Sat A updated, new Sat D launched
      insertTleSnapshot(
        makeSat({
          norad_id: 100,
          epoch_ts: 90000,
          shell_id: 2,
          status: 'operational',
          altitude_km: 551,
          inclination: 53,
          launch_year: 2020,
        })
      );
      insertTleSnapshot(
        makeSat({
          norad_id: 103,
          epoch_ts: 90001,
          shell_id: 2,
          status: 'raising',
          altitude_km: 350,
          inclination: 53,
          launch_year: 2024,
        })
      );
    });

    it('rebuildDailySnapshots aggregates correctly', () => {
      // Rebuild for day 1
      rebuildDailySnapshots('2026-03-15');
      const shells = queryShells();
      expect(shells.length).toBeGreaterThan(0);
    });

    it('queryShells returns latest date data', () => {
      rebuildDailySnapshots('2026-03-15');
      rebuildDailySnapshots('2026-03-16');
      const shells = queryShells();
      // All rows should be from the same (latest) date
      const dates = shells.map((s) => s.date);
      expect(new Set(dates).size).toBe(1);
    });

    it('queryGrowth returns ordered results', () => {
      rebuildDailySnapshots('2026-03-15');
      rebuildDailySnapshots('2026-03-16');
      const growth = queryGrowth();
      expect(growth.length).toBeGreaterThan(0);
      // Should be ordered by date, shell_id
      for (let i = 1; i < growth.length; i++) {
        const prev = growth[i - 1];
        const curr = growth[i];
        expect(prev.date <= curr.date || (prev.date === curr.date && prev.shell_id <= curr.shell_id)).toBe(true);
      }
    });

    it('querySatelliteHistory returns records for one satellite', () => {
      const history = querySatelliteHistory(100);
      expect(history.length).toBe(2);
      // Ordered by epoch_ts
      expect(history[0].epoch_ts).toBeLessThan(history[1].epoch_ts);
    });

    it('queryLaunches returns rows with new_launches > 0', () => {
      rebuildDailySnapshots('2026-03-15');
      rebuildDailySnapshots('2026-03-16');
      const launches = queryLaunches();
      for (const row of launches) {
        expect(row.new_launches).toBeGreaterThan(0);
      }
    });

    it('getLastIngestDate returns max date', () => {
      rebuildDailySnapshots('2026-03-15');
      rebuildDailySnapshots('2026-03-16');
      expect(getLastIngestDate()).toBe('2026-03-16');
    });
  });
});
