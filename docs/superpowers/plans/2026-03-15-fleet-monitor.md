# Fleet Monitor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/fleet` page that tracks Starlink constellation health over time using NORAD TLE data persisted in SQLite.

**Architecture:** SQLite database stores TLE snapshots and daily aggregates. A Node.js ingestion script fetches from CelesTrak, propagates via SGP4, classifies satellite status, and persists to SQLite. Next.js API routes serve data to a React client page with 7 recharts-based chart panels in a dark HUD aesthetic.

**Tech Stack:** Next.js 16 (App Router), better-sqlite3, recharts, satellite.js 6.x, vitest

**Spec:** `docs/superpowers/specs/2026-03-15-fleet-monitor-design.md`

**Branch:** `feat/fleet-monitor` (create before starting)

---

## Chunk 1: Foundation — Database, Config, and Classification

### Task 1: Branch Setup and Dependencies

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `src/lib/config.ts`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/fleet-monitor
```

- [ ] **Step 2: Install dependencies**

```bash
npm install better-sqlite3 recharts
npm install -D @types/better-sqlite3
```

- [ ] **Step 3: Add SHELL_TARGETS to config.ts**

Add after the existing `SHELL_ALT_BANDS` array in `src/lib/config.ts`:

```typescript
/** FCC-authorized constellation targets per shell (Gen1 + Gen2 filings) */
export const SHELL_TARGETS: Record<number, { target: number; label: string; altitude: string; planes: number; purpose: string }> = {
  0: { target: 2000, label: '33°', altitude: '525 km', planes: 72, purpose: 'Low-latitude fill' },
  1: { target: 2000, label: '43°', altitude: '540 km', planes: 72, purpose: 'Mid-latitude density' },
  2: { target: 4408, label: '53°', altitude: '550 km', planes: 72, purpose: 'Gen1 core' },
  3: { target: 2000, label: '70°', altitude: '570 km', planes: 36, purpose: 'High-latitude coverage' },
  4: { target: 520, label: '97.6°', altitude: '560 km', planes: 6, purpose: 'Sun-synchronous polar' },
};
```

- [ ] **Step 4: Add data/ entries to .gitignore**

Append to `.gitignore`:

```
# Fleet monitor database
data/fleet.db
data/fleet.db-wal
data/fleet.db-shm
data/last-celestrak-response.json
```

- [ ] **Step 5: Add ingest script to package.json**

Add to the `"scripts"` section:

```json
"ingest": "npx tsx scripts/ingest-tles.ts"
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore src/lib/config.ts
git commit -m "feat(fleet): add dependencies, shell targets, gitignore for fleet db"
```

---

### Task 2: Database Layer

**Files:**
- Create: `src/lib/fleet/db.ts`
- Test: `src/__tests__/fleet-db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/fleet-db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabase, getDatabase, closeDatabase } from '@/lib/fleet/db';

describe('fleet database', () => {
  beforeEach(() => {
    // Use in-memory database for tests
    initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates tle_snapshots table with correct schema', () => {
    const db = getDatabase();
    const info = db.prepare("PRAGMA table_info(tle_snapshots)").all() as { name: string }[];
    const columns = info.map((c) => c.name);
    expect(columns).toContain('norad_id');
    expect(columns).toContain('epoch_ts');
    expect(columns).toContain('altitude_km');
    expect(columns).toContain('status');
    expect(columns).toContain('ndot');
    expect(columns).toContain('epoch_age_hours');
  });

  it('creates daily_snapshots table with correct schema', () => {
    const db = getDatabase();
    const info = db.prepare("PRAGMA table_info(daily_snapshots)").all() as { name: string }[];
    const columns = info.map((c) => c.name);
    expect(columns).toContain('date');
    expect(columns).toContain('shell_id');
    expect(columns).toContain('operational_count');
    expect(columns).toContain('raising_count');
    expect(columns).toContain('deorbiting_count');
    expect(columns).toContain('isl_operational_count');
  });

  it('uses WAL journal mode', () => {
    const db = getDatabase();
    const result = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(result.journal_mode).toBe('wal');
  });

  it('inserts and retrieves a TLE snapshot', () => {
    const db = getDatabase();
    db.prepare(`INSERT INTO tle_snapshots (
      norad_id, epoch, epoch_ts, name, inclination, raan, eccentricity,
      mean_motion, ndot, altitude_km, launch_year, launch_number,
      shell_id, status, is_isl_capable, epoch_age_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      44235, 2460400.5, 1710000000, 'STARLINK-1000', 53.05, 120.5, 0.0001,
      15.06, 0.00001, 550.3, 2019, 74, 2, 'operational', 1, 2.5
    );
    const row = db.prepare('SELECT * FROM tle_snapshots WHERE norad_id = ?').get(44235) as { name: string; altitude_km: number };
    expect(row.name).toBe('STARLINK-1000');
    expect(row.altitude_km).toBeCloseTo(550.3, 1);
  });

  it('enforces primary key uniqueness (norad_id + epoch_ts)', () => {
    const db = getDatabase();
    const insert = db.prepare(`INSERT OR IGNORE INTO tle_snapshots (
      norad_id, epoch, epoch_ts, name, inclination, raan, eccentricity,
      mean_motion, ndot, altitude_km, launch_year, launch_number,
      shell_id, status, is_isl_capable, epoch_age_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run(44235, 2460400.5, 1710000000, 'STARLINK-1000', 53.05, 120.5, 0.0001, 15.06, 0.00001, 550.3, 2019, 74, 2, 'operational', 1, 2.5);
    insert.run(44235, 2460400.5, 1710000000, 'STARLINK-1000', 53.05, 120.5, 0.0001, 15.06, 0.00001, 551.0, 2019, 74, 2, 'operational', 1, 2.5);
    const count = db.prepare('SELECT COUNT(*) as c FROM tle_snapshots WHERE norad_id = 44235').get() as { c: number };
    expect(count.c).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/fleet-db.test.ts
```

Expected: FAIL — `@/lib/fleet/db` does not exist.

- [ ] **Step 3: Implement db.ts**

Create `src/lib/fleet/db.ts`:

```typescript
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function initDatabase(path: string = 'data/fleet.db'): Database.Database {
  if (db) return db;

  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tle_snapshots (
      norad_id       INTEGER NOT NULL,
      epoch          REAL    NOT NULL,
      epoch_ts       INTEGER NOT NULL,
      name           TEXT    NOT NULL,
      inclination    REAL    NOT NULL,
      raan           REAL    NOT NULL,
      eccentricity   REAL    NOT NULL,
      mean_motion    REAL    NOT NULL,
      ndot           REAL    NOT NULL,
      altitude_km    REAL    NOT NULL,
      launch_year    INTEGER NOT NULL,
      launch_number  INTEGER NOT NULL,
      shell_id       INTEGER NOT NULL,
      status         TEXT    NOT NULL DEFAULT 'unknown',
      is_isl_capable INTEGER NOT NULL DEFAULT 0,
      epoch_age_hours REAL   NOT NULL DEFAULT 0,
      PRIMARY KEY (norad_id, epoch_ts)
    );

    CREATE INDEX IF NOT EXISTS idx_epoch_ts ON tle_snapshots(epoch_ts);
    CREATE INDEX IF NOT EXISTS idx_norad_epoch ON tle_snapshots(norad_id, epoch_ts);
    CREATE INDEX IF NOT EXISTS idx_shell_epoch ON tle_snapshots(shell_id, epoch_ts);
    CREATE INDEX IF NOT EXISTS idx_status ON tle_snapshots(status, epoch_ts);

    CREATE TABLE IF NOT EXISTS daily_snapshots (
      date                TEXT    NOT NULL,
      shell_id            INTEGER NOT NULL,
      total_count         INTEGER NOT NULL DEFAULT 0,
      operational_count   INTEGER NOT NULL DEFAULT 0,
      raising_count       INTEGER NOT NULL DEFAULT 0,
      deorbiting_count    INTEGER NOT NULL DEFAULT 0,
      reentered_count     INTEGER NOT NULL DEFAULT 0,
      isl_operational_count INTEGER NOT NULL DEFAULT 0,
      avg_altitude        REAL    NOT NULL DEFAULT 0,
      min_altitude        REAL    NOT NULL DEFAULT 0,
      max_altitude        REAL    NOT NULL DEFAULT 0,
      new_launches        INTEGER NOT NULL DEFAULT 0,
      anomalous_count     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date, shell_id)
    );
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/fleet-db.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fleet/db.ts src/__tests__/fleet-db.test.ts
git commit -m "feat(fleet): SQLite database layer with WAL mode and schema"
```

---

### Task 3: Satellite Status Classification

**Files:**
- Create: `src/lib/fleet/classify.ts`
- Test: `src/__tests__/fleet-classify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/fleet-classify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifySatelliteStatus, type AltitudeHistory } from '@/lib/fleet/classify';

describe('classifySatelliteStatus', () => {
  it('returns operational when altitude within shell band', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      eccentricity: 0.0001,
      altitudeKm: 550,
      epochAgeHours: 2,
      history: [
        { altitude: 549, epochTs: 1000 },
        { altitude: 550, epochTs: 2000 },
        { altitude: 550, epochTs: 3000 },
      ],
    });
    expect(result).toBe('operational');
  });

  it('returns raising when below minAlt and consistently climbing', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      eccentricity: 0.0001,
      altitudeKm: 400,
      epochAgeHours: 2,
      history: [
        { altitude: 350, epochTs: 1000000 },
        { altitude: 370, epochTs: 1100000 },
        { altitude: 400, epochTs: 1200000 },
      ],
    });
    expect(result).toBe('raising');
  });

  it('returns deorbiting when below minAlt and descending fast', () => {
    // Descent of ~20 km per 100,000 seconds (~1.15 days) = ~17 km/day (>> 1 km/day threshold)
    const result = classifySatelliteStatus({
      inclination: 53,
      eccentricity: 0.0001,
      altitudeKm: 350,
      epochAgeHours: 2,
      history: [
        { altitude: 400, epochTs: 1000000 },
        { altitude: 380, epochTs: 1100000 },
        { altitude: 350, epochTs: 1200000 },
      ],
    });
    expect(result).toBe('deorbiting');
  });

  it('returns decayed when epoch age > 14 days and altitude < 250 km', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      eccentricity: 0.0001,
      altitudeKm: 200,
      epochAgeHours: 400, // ~16 days
      history: [
        { altitude: 300, epochTs: 1000000 },
        { altitude: 250, epochTs: 1100000 },
        { altitude: 200, epochTs: 1200000 },
      ],
    });
    expect(result).toBe('decayed');
  });

  it('returns anomalous when eccentricity > 0.005', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      eccentricity: 0.01,
      altitudeKm: 550,
      epochAgeHours: 2,
      history: [
        { altitude: 548, epochTs: 1000 },
        { altitude: 550, epochTs: 2000 },
        { altitude: 549, epochTs: 3000 },
      ],
    });
    expect(result).toBe('anomalous');
  });

  it('returns unknown when fewer than 3 history points', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      eccentricity: 0.0001,
      altitudeKm: 400,
      epochAgeHours: 2,
      history: [
        { altitude: 400, epochTs: 1000 },
      ],
    });
    expect(result).toBe('unknown');
  });

  it('returns decayed when SGP4 altitude is negative', () => {
    const result = classifySatelliteStatus({
      inclination: 53,
      eccentricity: 0.0001,
      altitudeKm: -100,
      epochAgeHours: 2,
      history: [],
    });
    expect(result).toBe('decayed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/fleet-classify.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement classify.ts**

Create `src/lib/fleet/classify.ts`:

```typescript
import { isOperationalAltitude, SHELL_ALT_BANDS } from '@/lib/config';

export interface AltitudeHistory {
  altitude: number;
  epochTs: number;
}

export type SatelliteStatus = 'operational' | 'raising' | 'deorbiting' | 'decayed' | 'anomalous' | 'unknown';

interface ClassifyInput {
  inclination: number;
  eccentricity: number;
  altitudeKm: number;
  epochAgeHours: number;
  history: AltitudeHistory[];
}

function getShellMinAlt(inclination: number): number {
  for (const band of SHELL_ALT_BANDS) {
    if (inclination >= band.minInc && inclination < band.maxInc) {
      return band.minAlt;
    }
  }
  return 460; // fallback
}

export function classifySatelliteStatus(input: ClassifyInput): SatelliteStatus {
  const { inclination, eccentricity, altitudeKm, epochAgeHours, history } = input;

  // Decayed: SGP4 error (negative/unreasonable altitude)
  if (altitudeKm < 0 || altitudeKm > 2000) return 'decayed';

  // Decayed: very old TLE + very low altitude
  if (epochAgeHours > 14 * 24 && altitudeKm < 250) return 'decayed';

  // Anomalous eccentricity (check before operational — a sat at correct altitude
  // but with high eccentricity has a problem)
  if (eccentricity > 0.005) return 'anomalous';

  // Operational: within shell band
  if (isOperationalAltitude(inclination, altitudeKm)) return 'operational';

  // Need history for raising/deorbiting classification
  if (history.length < 3) return 'unknown';

  const minAlt = getShellMinAlt(inclination);

  // Only classify raising/deorbiting if meaningfully below operational band
  if (altitudeKm >= minAlt - 20) return 'unknown';

  // Check altitude trend over last 3+ points
  const sorted = [...history].sort((a, b) => a.epochTs - b.epochTs);
  const recent = sorted.slice(-3);

  // All increasing?
  const allIncreasing = recent.every((p, i) =>
    i === 0 || p.altitude > recent[i - 1].altitude
  );

  // All decreasing?
  const allDecreasing = recent.every((p, i) =>
    i === 0 || p.altitude < recent[i - 1].altitude
  );

  if (allDecreasing) {
    // Check descent rate: must be >1 km/day to distinguish from drag
    const first = recent[0];
    const last = recent[recent.length - 1];
    const daysDelta = (last.epochTs - first.epochTs) / 86400;
    if (daysDelta > 0) {
      const rateKmPerDay = (first.altitude - last.altitude) / daysDelta;
      if (rateKmPerDay > 1) return 'deorbiting';
    }
  }

  if (allIncreasing) return 'raising';

  return 'unknown';
}

export function getShellId(inclination: number): number {
  for (let i = 0; i < SHELL_ALT_BANDS.length; i++) {
    if (inclination >= SHELL_ALT_BANDS[i].minInc && inclination < SHELL_ALT_BANDS[i].maxInc) {
      return i;
    }
  }
  return 2; // fallback to 53 degree shell
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/fleet-classify.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fleet/classify.ts src/__tests__/fleet-classify.test.ts
git commit -m "feat(fleet): satellite status classification with sliding window"
```

---

### Task 4: RAAN Precession Correction

**Files:**
- Create: `src/lib/fleet/raan-correction.ts`
- Test: `src/__tests__/fleet-raan.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/fleet-raan.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { correctRAANToEpoch } from '@/lib/fleet/raan-correction';

describe('correctRAANToEpoch', () => {
  it('returns same RAAN when epoch matches reference', () => {
    const refEpoch = 1710000000;
    const result = correctRAANToEpoch({
      raanDeg: 120,
      inclination: 53,
      meanMotion: 15.06,
      epochTs: refEpoch,
      referenceEpochTs: refEpoch,
    });
    expect(result).toBeCloseTo(120, 5);
  });

  it('shifts RAAN for a 1-day epoch difference', () => {
    const refEpoch = 1710000000;
    const result = correctRAANToEpoch({
      raanDeg: 120,
      inclination: 53,
      meanMotion: 15.06,
      epochTs: refEpoch - 86400, // 1 day earlier
      referenceEpochTs: refEpoch,
    });
    // J2 precession for 53 deg at ~550 km is roughly -5 to -6 deg/day
    // So correcting forward 1 day should decrease RAAN by ~5-6 degrees
    expect(result).toBeGreaterThan(113);
    expect(result).toBeLessThan(116);
  });

  it('wraps RAAN to 0-360 range', () => {
    const refEpoch = 1710000000;
    const result = correctRAANToEpoch({
      raanDeg: 2,
      inclination: 53,
      meanMotion: 15.06,
      epochTs: refEpoch - 86400,
      referenceEpochTs: refEpoch,
    });
    // 2 + (negative shift) should wrap around to ~356-357
    expect(result).toBeGreaterThan(350);
    expect(result).toBeLessThan(360);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/fleet-raan.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement raan-correction.ts**

Create `src/lib/fleet/raan-correction.ts`:

```typescript
/**
 * J2 RAAN precession correction.
 *
 * RAAN precesses due to Earth's oblateness (J2):
 *   dOmega/dt = -1.5 * n * J2 * (R_E / a)^2 * cos(i)
 *
 * For Starlink at ~550 km, this is roughly -5 to -7 deg/day.
 * Without correction, satellites in the same orbital plane appear
 * at different RAAN values if their TLE epochs differ by even hours.
 */

const J2 = 1.08263e-3;
const R_EARTH_KM = 6371;
const MU_EARTH = 398600.4418; // km^3/s^2

interface CorrectionInput {
  raanDeg: number;
  inclination: number; // degrees
  meanMotion: number;  // revs/day
  epochTs: number;     // unix timestamp of TLE epoch
  referenceEpochTs: number; // unix timestamp to correct to
}

export function correctRAANToEpoch(input: CorrectionInput): number {
  const { raanDeg, inclination, meanMotion, epochTs, referenceEpochTs } = input;

  // Semi-major axis from mean motion (revs/day -> rad/s)
  const nRadSec = (meanMotion * 2 * Math.PI) / 86400;
  const a = Math.pow(MU_EARTH / (nRadSec * nRadSec), 1 / 3);

  // J2 precession rate (rad/s)
  const cosI = Math.cos((inclination * Math.PI) / 180);
  const dOmegaDt = -1.5 * nRadSec * J2 * Math.pow(R_EARTH_KM / a, 2) * cosI;

  // Time delta in seconds
  const dtSec = referenceEpochTs - epochTs;

  // Apply correction
  const dOmegaDeg = (dOmegaDt * dtSec * 180) / Math.PI;
  let corrected = raanDeg + dOmegaDeg;

  // Wrap to 0-360
  corrected = ((corrected % 360) + 360) % 360;
  return corrected;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/fleet-raan.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fleet/raan-correction.ts src/__tests__/fleet-raan.test.ts
git commit -m "feat(fleet): J2 RAAN precession correction for orbital plane analysis"
```

---

### Task 5: SQL Query Functions

**Files:**
- Create: `src/lib/fleet/queries.ts`
- Test: `src/__tests__/fleet-queries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/fleet-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, getDatabase, closeDatabase } from '@/lib/fleet/db';
import {
  insertTleSnapshot,
  rebuildDailySnapshots,
  queryGrowth,
  queryShells,
  queryLaunches,
  querySatelliteHistory,
} from '@/lib/fleet/queries';

function seedData() {
  const db = getDatabase();
  const insert = db.prepare(`INSERT OR IGNORE INTO tle_snapshots (
    norad_id, epoch, epoch_ts, name, inclination, raan, eccentricity,
    mean_motion, ndot, altitude_km, launch_year, launch_number,
    shell_id, status, is_isl_capable, epoch_age_hours
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  // Day 1: 2 operational sats in 53 deg shell
  insert.run(44235, 2460400.5, 1710000000, 'STARLINK-1000', 53.05, 120.5, 0.0001, 15.06, 0.00001, 550.3, 2022, 1, 2, 'operational', 1, 2);
  insert.run(44236, 2460400.5, 1710000000, 'STARLINK-1001', 53.05, 125.5, 0.0001, 15.06, 0.00001, 551.0, 2022, 1, 2, 'operational', 1, 2);
  // Day 1: 1 raising sat in 53 deg shell
  insert.run(44237, 2460400.5, 1710000000, 'STARLINK-1002', 53.05, 130.5, 0.0001, 15.20, 0.00001, 380.0, 2024, 5, 2, 'raising', 1, 2);
  // Day 2: raising sat now operational
  insert.run(44237, 2460401.5, 1710086400, 'STARLINK-1002', 53.05, 130.5, 0.0001, 15.06, 0.00001, 549.0, 2024, 5, 2, 'operational', 1, 2);

  rebuildDailySnapshots('2024-03-10');
  rebuildDailySnapshots('2024-03-11');
}

describe('fleet queries', () => {
  beforeEach(() => {
    initDatabase(':memory:');
    seedData();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('queryShells returns per-shell summary', () => {
    const shells = queryShells();
    const shell2 = shells.find((s) => s.shell_id === 2);
    expect(shell2).toBeDefined();
    expect(shell2!.operational_count).toBeGreaterThanOrEqual(2);
  });

  it('queryGrowth returns daily data', () => {
    const growth = queryGrowth();
    expect(growth.length).toBeGreaterThan(0);
    expect(growth[0]).toHaveProperty('date');
    expect(growth[0]).toHaveProperty('shell_id');
    expect(growth[0]).toHaveProperty('operational_count');
  });

  it('querySatelliteHistory returns altitude over time', () => {
    const history = querySatelliteHistory(44237);
    expect(history.length).toBe(2);
    expect(history[0].altitude_km).toBe(380.0);
    expect(history[1].altitude_km).toBe(549.0);
  });

  it('queryLaunches returns new launch counts', () => {
    const launches = queryLaunches();
    expect(launches.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/fleet-queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement queries.ts**

Create `src/lib/fleet/queries.ts`. This file contains all SQL query functions used by the API routes:

- `insertTleSnapshot(row)` — INSERT OR IGNORE a single TLE snapshot
- `getRecentAltitudes(noradId, limit)` — fetch recent altitude history for status classification
- `rebuildDailySnapshots(date)` — delete + recompute daily aggregates for a given date
- `queryGrowth(from?, to?)` — daily constellation size by shell
- `queryShells()` — latest daily snapshot per shell
- `queryLaunches(from?, to?)` — daily snapshots where new_launches > 0
- `querySatelliteHistory(noradId, limit)` — altitude history for one satellite
- `queryAltitudes(date?)` — latest snapshot per satellite (for altitude histogram)
- `queryPlanes(shellId)` — latest snapshot per satellite in a shell (for RAAN chart)
- `getRecordCount()` — total rows in tle_snapshots
- `getLastIngestDate()` — MAX(date) from daily_snapshots

All queries use named parameters where applicable and return typed row interfaces (`TleSnapshotRow`, `DailySnapshotRow`).

Key implementation details:
- `rebuildDailySnapshots` uses a subquery to get the latest snapshot per satellite where epoch_ts <= date end, then aggregates by shell_id
- `queryAltitudes` and `queryPlanes` use the "latest epoch per norad_id" pattern with a self-join
- All queries exclude `status = 'decayed'` satellites from counts

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/fleet-queries.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fleet/queries.ts src/__tests__/fleet-queries.test.ts
git commit -m "feat(fleet): SQL query functions for all API routes"
```

---

## Chunk 2: Ingestion Script

### Task 6: TLE Ingestion Script

**Files:**
- Create: `src/lib/fleet/ingest-helpers.ts`
- Create: `scripts/ingest-tles.ts`
- Test: `src/__tests__/fleet-ingest.test.ts`

- [ ] **Step 1: Write the failing test for ingestion helpers**

Create `src/__tests__/fleet-ingest.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterStarlinkName, parseLaunchInfo } from '@/lib/fleet/ingest-helpers';

describe('filterStarlinkName', () => {
  it('accepts STARLINK-1234', () => {
    expect(filterStarlinkName('STARLINK-1234')).toBe(true);
  });

  it('rejects STARSHIELD', () => {
    expect(filterStarlinkName('STARSHIELD-1')).toBe(false);
  });

  it('rejects debris objects', () => {
    expect(filterStarlinkName('OBJECT A')).toBe(false);
  });

  it('rejects TBA entries', () => {
    expect(filterStarlinkName('TBA - TO BE ASSIGNED')).toBe(false);
  });

  it('accepts STARLINK-30000 (high numbers)', () => {
    expect(filterStarlinkName('STARLINK-30000')).toBe(true);
  });
});

describe('parseLaunchInfo', () => {
  it('parses international designator', () => {
    const result = parseLaunchInfo('19029A');
    expect(result).toEqual({ year: 2019, launch: 29 });
  });

  it('parses 2-digit year >= 57 as 1900s', () => {
    const result = parseLaunchInfo('98067A');
    expect(result).toEqual({ year: 1998, launch: 67 });
  });

  it('parses 2-digit year < 57 as 2000s', () => {
    const result = parseLaunchInfo('24045B');
    expect(result).toEqual({ year: 2024, launch: 45 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/fleet-ingest.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ingest-helpers.ts**

Create `src/lib/fleet/ingest-helpers.ts` with:

- `filterStarlinkName(name)` — regex test for `STARLINK-\d+`
- `parseLaunchInfo(intlDesig)` — parse 2-digit year + 3-digit launch number from international designator
- `OmmRecord` interface — CelesTrak OMM JSON record shape (OBJECT_NAME, NORAD_CAT_ID, EPOCH, MEAN_MOTION, ECCENTRICITY, INCLINATION, RA_OF_ASC_NODE, MEAN_MOTION_DOT, OBJECT_ID, TLE_LINE1, TLE_LINE2)
- `parseOmmRecord(record)` — extract fields from OMM JSON into a flat structure

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/fleet-ingest.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Implement the ingestion script**

Create `scripts/ingest-tles.ts`. This is the main entry point run via `npm run ingest`. It:

1. Fetches CelesTrak OMM JSON with exponential backoff retry (3 attempts: 1s, 4s, 16s). Caches successful response to `data/last-celestrak-response.json`. Falls back to cache if unreachable.
2. Filters records: only `STARLINK-\d+` names pass.
3. For each record: parses via `satellite.twoline2satrec()`, propagates to epoch via `satellite.propagate(satrec, epochDate)`, extracts geodetic altitude, validates `satrec.error === 0` and altitude in 0-2000 km range.
4. Computes: shell ID via `getShellId()`, status via `classifySatelliteStatus()` (fetching recent altitude history from DB), ISL capability via `isISLCapable()`, launch info via `parseLaunchInfo()`.
5. Inserts via `insertTleSnapshot()` (INSERT OR IGNORE).
6. Rebuilds `daily_snapshots` for all affected dates.
7. Logs summary: inserted, rejected (with reasons), total records.

- [ ] **Step 6: Verify data directory exists and test ingest**

```bash
mkdir -p data
npm run ingest
```

Expected: Fetches TLEs, inserts records, prints summary.

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest-tles.ts src/lib/fleet/ingest-helpers.ts src/__tests__/fleet-ingest.test.ts
git commit -m "feat(fleet): TLE ingestion script with CelesTrak fetch, SGP4 validation, and status classification"
```

---

## Chunk 3: API Routes

### Task 7: Fleet API Routes

**Files:**
- Create: `src/app/api/fleet/growth/route.ts`
- Create: `src/app/api/fleet/shells/route.ts`
- Create: `src/app/api/fleet/altitudes/route.ts`
- Create: `src/app/api/fleet/launches/route.ts`
- Create: `src/app/api/fleet/satellite/[noradId]/route.ts`
- Create: `src/app/api/fleet/planes/route.ts`

All routes follow the same pattern:
- Import `initDatabase` from `@/lib/fleet/db` and the relevant query function from `@/lib/fleet/queries`
- Export `async function GET(request: NextRequest)` (or just `GET()` for parameterless routes)
- Call `initDatabase()` to ensure DB is ready
- Parse query params from `request.nextUrl.searchParams`
- Call query function, return `Response.json(data)`
- Catch errors and return empty `Response.json([], { status: 200 })` (never error responses — charts handle empty data gracefully)

- [ ] **Step 1: Create all 6 route files**

Route implementations:

- `/api/fleet/growth` — calls `queryGrowth(from, to)` with optional date range params
- `/api/fleet/shells` — calls `queryShells()`, `getRecordCount()`, `getLastIngestDate()`, returns `{ shells, recordCount, lastIngest }`
- `/api/fleet/altitudes` — calls `queryAltitudes(date)` with optional date param
- `/api/fleet/launches` — calls `queryLaunches(from, to)` with optional date range params
- `/api/fleet/satellite/[noradId]` — parses noradId from dynamic route `params`, calls `querySatelliteHistory(id)`. Uses `{ params }: { params: Promise<{ noradId: string }> }` signature per Next.js 16.
- `/api/fleet/planes` — parses shell query param (default: 2), calls `queryPlanes(shell)`

- [ ] **Step 2: Commit**

```bash
git add src/app/api/fleet/
git commit -m "feat(fleet): API routes for growth, shells, altitudes, launches, satellite history, and planes"
```

---

## Chunk 4: Frontend — Page Shell and Shared Components

### Task 8: Page Shell and Shared Components

**Files:**
- Create: `src/app/fleet/page.tsx`
- Create: `src/components/fleet/FleetPage.tsx`
- Create: `src/components/fleet/ChartPanel.tsx`
- Create: `src/components/fleet/FleetTooltip.tsx`
- Create: `src/components/fleet/SummaryStrip.tsx`
- Create: `src/components/fleet/shell-colors.ts`

- [ ] **Step 1: Create shell-colors.ts**

Maps shell ID (0-4) to `{ color, bg, label }`. Colors match existing globe view palette: 33 deg=gold (#facc15), 43 deg=orange (#fb923c), 53 deg=blue (#60a5fa), 70 deg=teal (#2dd4bf), 97.6 deg=pink (#fb7185).

- [ ] **Step 2: Create ChartPanel.tsx**

Shared wrapper for all chart panels. Props: `title`, `subtitle`, `footnote?`, `controls?` (ReactNode for time range selectors etc.), `fullWidth?`, `children`. Renders dark card with monospace text, consistent padding and borders matching the HUD aesthetic. `'use client'` directive.

- [ ] **Step 3: Create FleetTooltip.tsx**

Shared recharts tooltip component. Dark background (rgba(0,0,0,0.9)), border, monospace font. Accepts standard recharts `TooltipProps`. `'use client'` directive.

- [ ] **Step 4: Create SummaryStrip.tsx**

5-card grid: Total Fleet (white), Operational (green #4ade80), ISL Capable (blue #60a5fa), Orbit Raising (yellow #fbbf24), Deorbiting (red #f87171). Each card shows: uppercase label, large number, description subtitle. Props: `data: { total, operational, islCapable, raising, deorbiting } | null`. Shows "—" when data is null. `'use client'` directive.

- [ ] **Step 5: Create FleetPage.tsx**

Main layout component. `'use client'` directive. On mount, fetches `/api/fleet/shells` to populate summary strip and check if data exists. Renders:
- Top bar: "STARLINK FLEET" title, "Back to Globe" link, Last Ingest time, Record count
- SummaryStrip with aggregated shell data
- If no data: prompt to run `npm run ingest`
- If data exists: 2-column CSS grid with all 7 chart components (ConstellationGrowth is full-width)

- [ ] **Step 6: Create page.tsx entry point**

Create `src/app/fleet/page.tsx`: Server component that dynamically imports FleetPage with `ssr: false` via `next/dynamic`, matching the existing globe page pattern.

- [ ] **Step 7: Commit**

```bash
git add src/app/fleet/ src/components/fleet/FleetPage.tsx src/components/fleet/ChartPanel.tsx \
  src/components/fleet/FleetTooltip.tsx src/components/fleet/SummaryStrip.tsx \
  src/components/fleet/shell-colors.ts
git commit -m "feat(fleet): page shell with top bar, summary strip, chart grid layout, and shared components"
```

---

## Chunk 5: Chart Components (1-4)

### Task 9: Constellation Growth Chart

**Files:**
- Create: `src/components/fleet/ConstellationGrowth.tsx`

`'use client'`. Fetches `/api/fleet/growth` with time range filter. Groups data by date, pivots shell_id into columns. Renders stacked AreaChart via recharts with shell colors. Controls: 3M/1Y/ALL time range selector. Uses ChartPanel wrapper and FleetTooltip.

- [ ] **Step 1: Implement and commit**

```bash
git add src/components/fleet/ConstellationGrowth.tsx
git commit -m "feat(fleet): Constellation Growth stacked area chart"
```

---

### Task 10: Altitude Distribution Chart

**Files:**
- Create: `src/components/fleet/AltitudeDistribution.tsx`

`'use client'`. Fetches `/api/fleet/altitudes`. Bins satellites by 10 km altitude intervals. Each bar colored by dominant shell in that bin. Renders BarChart with Cell-level coloring. Uses ChartPanel with footnote about gaps indicating orbit-raising.

- [ ] **Step 1: Implement and commit**

```bash
git add src/components/fleet/AltitudeDistribution.tsx
git commit -m "feat(fleet): Altitude Distribution histogram chart"
```

---

### Task 11: Shell Fill Rate

**Files:**
- Create: `src/components/fleet/ShellFillRate.tsx`

`'use client'`. Receives `shells` prop from FleetPage. Renders horizontal progress bars (CSS, not recharts) for each shell. Imports `SHELL_TARGETS` from config.ts for target counts. Shows: shell color, label, metadata (purpose, altitude, planes), operational/target count, percentage. Orders shells by size: 53 deg, 70 deg, 43 deg, 97.6 deg, 33 deg.

- [ ] **Step 1: Implement and commit**

```bash
git add src/components/fleet/ShellFillRate.tsx
git commit -m "feat(fleet): Shell Fill Rate progress bars with FCC targets"
```

---

### Task 12: Launch Cadence Chart

**Files:**
- Create: `src/components/fleet/LaunchCadence.tsx`

`'use client'`. Fetches `/api/fleet/launches`. Groups by month or quarter (user toggle). Renders BarChart. Quarterly format: `Q1'24`. Monthly: `2024-01`. Uses ChartPanel with monthly/quarterly toggle controls.

- [ ] **Step 1: Implement and commit**

```bash
git add src/components/fleet/LaunchCadence.tsx
git commit -m "feat(fleet): Launch Cadence bar chart with monthly/quarterly toggle"
```

---

## Chunk 6: Chart Components (5-7)

### Task 13: Satellite Lifecycle Chart

**Files:**
- Create: `src/components/fleet/SatelliteLifecycle.tsx`

`'use client'`. Fetches `/api/fleet/altitudes` to find sample satellites (3 raising + 2 deorbiting), then fetches their individual histories via `/api/fleet/satellite/:noradId`. Renders multi-line LineChart with days-since-launch as X axis and altitude as Y axis. ReferenceArea for operational altitude band (460-570 km). Color-coded by status.

- [ ] **Step 1: Implement and commit**

```bash
git add src/components/fleet/SatelliteLifecycle.tsx
git commit -m "feat(fleet): Satellite Lifecycle multi-line altitude chart"
```

---

### Task 14: Orbital Planes (RAAN) Chart

**Files:**
- Create: `src/components/fleet/OrbitalPlanes.tsx`

`'use client'`. Fetches `/api/fleet/planes?shell=N`. Applies J2 RAAN precession correction to common reference epoch (most recent midnight UTC) using `correctRAANToEpoch()`. Renders ScatterChart with RAAN 0-360 on X axis and altitude deviation from shell mean on Y axis. Shell selector tabs. Uses ChartPanel with precession correction footnote.

- [ ] **Step 1: Implement and commit**

```bash
git add src/components/fleet/OrbitalPlanes.tsx
git commit -m "feat(fleet): Orbital Planes RAAN scatter chart with J2 precession correction"
```

---

### Task 15: ISL Coverage Chart

**Files:**
- Create: `src/components/fleet/IslCoverage.tsx`

`'use client'`. Fetches `/api/fleet/growth`. Aggregates `isl_operational_count / operational_count` across shells per date. Renders AreaChart with percentage on Y axis. ReferenceLine at 50% threshold. Uses ChartPanel with ISL heuristic footnote.

- [ ] **Step 1: Implement and commit**

```bash
git add src/components/fleet/IslCoverage.tsx
git commit -m "feat(fleet): ISL Coverage area chart with 50% threshold"
```

---

## Chunk 7: Integration and Verification

### Task 16: Build Verification

- [ ] **Step 1: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 2: Run all fleet tests**

```bash
npx vitest run src/__tests__/fleet-*.test.ts
```

Expected: ALL PASS

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: ALL PASS (existing tests unbroken)

- [ ] **Step 4: Build the project**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Run ingest and verify page**

```bash
mkdir -p data
npm run ingest
npm run dev:next
```

Open `http://localhost:3000/fleet`. Verify: top bar, summary strip, all 7 charts render with data, tooltips work, shell selector tabs work, time range toggle works.

- [ ] **Step 6: Fix any issues and commit**

```bash
git add -A
git commit -m "fix(fleet): integration fixes from build verification"
```

---

### Task 17: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add fleet monitor section**

Add after the "### Ground Stations" section in CLAUDE.md:

```markdown
### Fleet Monitor (`/fleet`)

Separate page tracking Starlink constellation health over time using NORAD TLE data.

- **Database**: `data/fleet.db` (SQLite, gitignored) — `tle_snapshots` (per-satellite per-epoch) and `daily_snapshots` (materialized daily aggregates per shell)
- **Ingestion**: `npm run ingest` fetches from CelesTrak, propagates via SGP4, classifies status, persists to SQLite
- **Status classification** (`src/lib/fleet/classify.ts`) — sliding window of 3+ TLE epochs: `operational`, `raising`, `deorbiting`, `decayed`, `anomalous`, `unknown`
- **API routes**: `/api/fleet/{growth,shells,altitudes,launches,satellite/[noradId],planes}`
- **Charts** (`src/components/fleet/`) — 7 recharts panels: Constellation Growth, Altitude Distribution, Shell Fill Rate, Launch Cadence, Satellite Lifecycle, Orbital Planes (RAAN with J2 correction), ISL Coverage
- **RAAN correction** (`src/lib/fleet/raan-correction.ts`) — J2 precession correction to common reference epoch for orbital plane analysis
- **Shell targets** (`SHELL_TARGETS` in `config.ts`) — FCC-authorized constellation sizes per shell
- **Filtering**: Only `STARLINK-\d+` names ingested (rejects Starshield, debris, TBA objects)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add fleet monitor section to CLAUDE.md"
```
