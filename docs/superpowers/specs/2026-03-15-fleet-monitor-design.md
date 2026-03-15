# Fleet Monitor Page — Design Spec

## Overview

A new `/fleet` route within the Next.js app that provides a comprehensive fleet observatory for the Starlink constellation. Uses only confirmed public NORAD TLE data from CelesTrak. Persists data in SQLite for historical trend analysis.

## Goals

- Track constellation health over time: operational counts, shell fill rates, launch cadence, deorbit trends
- Provide per-satellite lifecycle drill-down: orbit raising curves, time-to-operational, deorbit tracking
- Visualize orbital structure: altitude distributions, RAAN plane spacing, ISL coverage trends
- Accumulate data going forward from CelesTrak (no historical backfill in v1; Space-Track.org integration deferred)

## Non-Goals

- No dish telemetry or connection quality data (that stays on the globe view)
- No real-time satellite position tracking (this page is about fleet trends, not live state)
- No user accounts or multi-tenant data
- No historical backfill from Space-Track.org (future enhancement)

## Data Layer

### SQLite Database

Location: `data/fleet.db` (gitignored)

Initialize with:
```sql
PRAGMA journal_mode=WAL;    -- allow concurrent reads during writes
PRAGMA busy_timeout=5000;   -- wait up to 5s on lock contention
```

#### `tle_snapshots` table

Stores extracted fields from each TLE update. One row per satellite per TLE epoch.

| Column | Type | Description |
|--------|------|-------------|
| norad_id | INTEGER | NORAD catalog number |
| epoch | REAL | Julian date from TLE |
| epoch_ts | INTEGER | Unix timestamp (for easy queries) |
| name | TEXT | Satellite name (e.g., "STARLINK-1234") |
| inclination | REAL | Degrees |
| raan | REAL | Right Ascension of Ascending Node (degrees) |
| eccentricity | REAL | Orbital eccentricity |
| mean_motion | REAL | Revolutions per day |
| ndot | REAL | First derivative of mean motion (revs/day²) — maneuver/drag indicator |
| altitude_km | REAL | SGP4 instantaneous altitude at TLE epoch (propagated via `satellite.js`) |
| launch_year | INTEGER | From international designator |
| launch_number | INTEGER | Launch sequence within year (parsed per `getLaunchInfo` in `satellite-store.ts`) |
| shell_id | INTEGER | 0=33°, 1=43°, 2=53°, 3=70°, 4=97.6° (matches `SHELL_ALT_BANDS` index in `config.ts`) |
| status | TEXT | `operational`, `raising`, `deorbiting`, `decayed`, `anomalous`, `unknown` |
| is_isl_capable | INTEGER | 1 if matches ISL heuristic from `isl-capability.ts` |
| epoch_age_hours | REAL | Hours between TLE epoch and ingest time — staleness indicator |
| PRIMARY KEY | (norad_id, epoch_ts) | |

Indexes:
- `idx_epoch_ts` on `epoch_ts` — for time-range queries
- `idx_norad_epoch` on `(norad_id, epoch_ts)` — for per-satellite history
- `idx_shell_epoch` on `(shell_id, epoch_ts)` — for per-shell aggregation
- `idx_status` on `(status, epoch_ts)` — for status-filtered queries

#### `daily_snapshots` table

Materialized daily aggregates, one row per shell per day. Rebuilt on each ingest.

| Column | Type | Description |
|--------|------|-------------|
| date | TEXT | YYYY-MM-DD |
| shell_id | INTEGER | 0–4 |
| total_count | INTEGER | All tracked satellites in this shell (excluding `decayed`) |
| operational_count | INTEGER | `status = 'operational'` |
| raising_count | INTEGER | `status = 'raising'` |
| deorbiting_count | INTEGER | `status = 'deorbiting'` (currently in process, not completed) |
| reentered_count | INTEGER | Satellites that transitioned to `decayed` on this day |
| isl_operational_count | INTEGER | ISL-capable AND operational (contributes to ISL mesh) |
| avg_altitude | REAL | Mean altitude (km) of operational satellites |
| min_altitude | REAL | Lowest altitude in shell |
| max_altitude | REAL | Highest altitude in shell |
| new_launches | INTEGER | Satellites first seen this day |
| anomalous_count | INTEGER | `status = 'anomalous'` (eccentricity > 0.005 or other flags) |
| PRIMARY KEY | (date, shell_id) | |

### Satellite Status Classification

Status is determined using a **sliding window of the last 3+ TLE epochs** for each satellite (not just two). This avoids false classifications from drag, phasing maneuvers, and station-keeping oscillations.

| Status | Criteria |
|--------|----------|
| `operational` | Altitude within shell's operational band (`isOperationalAltitude()`) |
| `raising` | Below shell `minAlt` by >20 km AND altitude consistently increasing over last 3+ epochs AND descent rate inconsistent with drag-only decay |
| `deorbiting` | Below shell `minAlt` AND altitude consistently decreasing over last 3+ epochs at >1 km/day (faster than drag-only at 500 km which is ~0.1-0.3 km/day) |
| `decayed` | TLE epoch age >14 days AND last known altitude <250 km, OR SGP4 propagation returns error/negative altitude |
| `anomalous` | Eccentricity >0.005 (near-circular orbits expected for operational Starlink; elevated eccentricity signals failed propulsion, transfer orbit, or uncontrolled tumble) |
| `unknown` | Fewer than 3 TLE epochs available, or doesn't match any above criteria |

**ndot as auxiliary signal**: Large positive `ndot` (mean motion increasing = orbit shrinking) corroborates deorbiting. Large negative `ndot` combined with altitude increase corroborates active thrusting. This is more reliable than altitude comparison alone since it's derived from the orbit determination process itself.

### Ingestion Script

`scripts/ingest-tles.ts` — Node.js script, runnable via `npm run ingest`.

#### Data Fetching

Fetch current Starlink TLEs from CelesTrak GP endpoint: `https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json` (OMM JSON format, no auth required).

Use `satellite.js`'s `omm2satrec()` function to convert OMM JSON records directly to satrec objects for SGP4 propagation — avoids TLE line string reconstruction.

**Retry logic**: Exponential backoff with 3 retries (1s, 4s, 16s). Cache the last successful response to disk (`data/last-celestrak-response.json`). If CelesTrak is unreachable, use cached data and log a warning.

#### Filtering

1. **Name filter**: Only ingest satellites with names matching `STARLINK-\d+` pattern. Reject Starshield, debris objects (`OBJECT A/B/C`), and `TBA - TO BE ASSIGNED` entries. CelesTrak's `GROUP=starlink` is known to include non-commercial Starlink objects (see CLAUDE.md warning).
2. **SGP4 validation**: After `sgp4(satrec, 0)`, check `satrec.error !== 0`. Also validate altitude is in sane range (100–2000 km). Reject and log records that fail.
3. **Epoch age**: Compute `epoch_age_hours` = (ingest time - TLE epoch). Flag but still ingest stale TLEs (>48h) — they're useful for historical records but should be marked for downstream consumers.

#### Processing

1. Parse each OMM JSON record via `omm2satrec()`
2. Propagate to epoch: `sgp4(satrec, 0)` → ECI → geodetic → altitude. This matches the existing visualization's altitude computation and is consistent with `SHELL_ALT_BANDS` calibration. Do NOT use Kepler's third law on mean motion — those altitudes differ significantly from SGP4 instantaneous values.
3. Compute derived fields:
   - Shell classification using inclination bands from `config.ts` (`SHELL_ALT_BANDS`)
   - Status classification using sliding window (see Status Classification above)
   - ISL capability using heuristic from `isl-capability.ts`
   - Extract `ndot` from OMM JSON `MEAN_MOTION_DOT` field
   - Eccentricity anomaly check (>0.005)
4. Upsert into `tle_snapshots` (INSERT OR IGNORE — same norad_id + epoch_ts = skip)
5. Rebuild `daily_snapshots` for affected dates
6. Log summary: new records inserted, rejected records (with reasons), total records, database size

#### Scheduling

Default ingest interval: **3 hours** (CelesTrak updates every 2–4 hours). Can be triggered from the server's existing polling loop or via cron. The ingest is idempotent — running it multiple times with the same data is a no-op. CelesTrak rate-limits to ~30 requests/hour per IP, so frequent polling is safe.

#### Data Retention

To manage database growth (~10M rows/year):
- For satellites with `status = 'operational'` and altitude stable within 5 km for 30+ days: thin historical snapshots to one per week
- Keep full resolution for satellites that are actively maneuvering (`raising`, `deorbiting`, `anomalous`)
- Run `VACUUM` after thinning to reclaim space
- Retention thinning runs as part of the ingest script (after insert, before daily snapshot rebuild)

### API Routes

All under `/api/fleet/`. Return JSON. Support `from` and `to` query params (ISO date strings) for time filtering.

| Route | Description | Source Table |
|-------|-------------|--------------|
| `GET /api/fleet/growth` | Daily constellation size by shell | `daily_snapshots` |
| `GET /api/fleet/altitudes?date=` | Altitude distribution snapshot (propagated to requested date, not epoch) | `tle_snapshots` |
| `GET /api/fleet/launches` | Launch cadence (new sats per month/quarter) | `daily_snapshots` |
| `GET /api/fleet/satellite/:noradId` | Individual satellite altitude history | `tle_snapshots` |
| `GET /api/fleet/shells` | Current shell summary stats (propagated to now) | `daily_snapshots` + live propagation |
| `GET /api/fleet/planes?shell=` | RAAN distribution, corrected to common reference epoch | `tle_snapshots` (latest per sat) |

#### Current-State vs Historical Queries

Two types of altitude data serve different purposes:

- **Historical records** (`tle_snapshots.altitude_km`): SGP4-at-epoch. Used for growth charts, lifecycle curves, launch cadence — anything plotting data over time.
- **Current-state views** (summary strip, altitude distribution, shell fill rate): Propagate the latest TLE for each satellite to `Date.now()` using SGP4. A deorbiting satellite with a 3-day-old TLE could have dropped 15–60 km since epoch. The `/api/fleet/shells` and `/api/fleet/altitudes` endpoints perform this live propagation. Accuracy degrades with TLE age — responses include a `stale_count` field indicating how many satellites have TLE age >48h.

## Frontend

### Page Structure

Single scrollable page at `/fleet` with dark HUD aesthetic matching the main globe view. Uses the existing shell color palette (53°=blue, 70°=teal, 43°=orange, 97.6°=pink-red, 33°=gold).

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ STARLINK FLEET          TLE Age · Last Ingest · Records │  ← top bar
├─────────────────────────────────────────────────────────┤
│ [Total] [Operational] [ISL Capable] [Raising] [Deorbit] │  ← summary strip (5 cards)
├─────────────────────────────────────────────────────────┤
│             Constellation Growth (stacked area)          │  ← full width
├────────────────────────────┬────────────────────────────┤
│   Altitude Distribution    │     Shell Fill Rate        │  ← 2-column grid
│   (histogram, 10km bins)   │     (progress bars)        │
├────────────────────────────┼────────────────────────────┤
│   Launch Cadence           │     Satellite Lifecycle     │
│   (bar chart)              │     (altitude curves)       │
├────────────────────────────┼────────────────────────────┤
│   Orbital Planes (RAAN)    │     ISL Coverage            │
│   (scatter plot)           │     (area chart)            │
└────────────────────────────┴────────────────────────────┘
```

### Chart Components

All charts are React components. Charting library: `recharts` (new dependency — tree-shakeable, React-native, good dark-theme support).

Each chart panel includes:
- **Title** — uppercase monospace, shell color accent
- **Subtitle** — one-line plain-English explanation
- **Axes** — labeled with units, grid lines
- **Hover tooltip** — dark popover with exact values, contextual stats, per-shell breakdown where applicable
- **Legend** — shell colors with purpose descriptions
- **Footnote** — data source caveats, methodology notes

#### 1. Constellation Growth
- **Type**: Stacked area chart
- **Data**: `daily_snapshots` aggregated by date, stacked by shell
- **Controls**: Time range selector (3M / 1Y / ALL)
- **Tooltip**: Date, per-shell count, total
- **Legend**: Shell name, inclination, altitude, purpose

#### 2. Altitude Distribution
- **Type**: Histogram (10 km bins)
- **Data**: Latest TLE per satellite, **propagated to current time** (not epoch altitude), binned by altitude
- **Bars**: Colored by shell assignment
- **Tooltip**: Altitude range, shell, satellite count
- **Overlay**: Dashed vertical lines showing shell operational bands
- **Footnote**: Gaps between clusters indicate orbit-raising satellites. Stale TLEs (>48h) shown with reduced opacity.

#### 3. Shell Fill Rate
- **Type**: Horizontal progress bars (one per shell)
- **Data**: Latest `daily_snapshots` operational count vs FCC target
- **Per-bar**: Shell color, name, metadata (purpose, altitude, plane count), operational/target count, percentage
- **FCC targets** (hardcoded in `config.ts` as `SHELL_TARGETS`):
  - 53° @ 550 km: 4,408 (Gen1 Phase 1: 1,584 + Gen1 Phase 2: 2,824)
  - 70° @ 570 km: 2,000
  - 43° @ 540 km: 2,000
  - 97.6° @ 560 km: 520
  - 33° @ 525 km: 2,000
- **Footnote**: Targets from FCC Gen1/Gen2 filings (cite FCC order number). Note: SpaceX has lowered many 53° sats from 550→480 km; actual constellation evolves beyond original filings.

#### 4. Launch Cadence
- **Type**: Bar chart (vertical bars)
- **Data**: `daily_snapshots.new_launches` summed by month or quarter
- **Controls**: Monthly / Quarterly toggle
- **Tooltip**: Period, satellite count, estimated launch count + avg per launch
- **Visual**: Current incomplete period shown with dashed border
- **Footnote**: "First seen" = earliest TLE epoch for each NORAD ID

#### 5. Satellite Lifecycle
- **Type**: Multi-line chart (altitude over time, one line per satellite)
- **Data**: `tle_snapshots` for selected satellite(s)
- **Default**: Show a sample of recently launched satellites + any currently deorbiting
- **Interaction**: Click a satellite in any other chart to add its lifecycle trace here
- **Color coding**: Green = raising, blue = operational, yellow = in transit, red dashed = deorbiting, orange dot = anomalous eccentricity
- **Overlay**: Horizontal band showing target altitude range
- **Tooltip**: Satellite name, NORAD ID, shell, current altitude, status, eccentricity, orbit-raise duration vs average, TLE age

#### 6. Orbital Planes (RAAN)
- **Type**: Scatter plot (X = RAAN 0°–360°, Y = altitude deviation from shell mean)
- **Data**: Latest `tle_snapshots` per satellite, filtered by selected shell
- **RAAN precession correction**: All RAAN values corrected to a common reference epoch (most recent midnight UTC) using J2 precession rate: `dΩ/dt = -1.5 · n · J2 · (R_E/a)² · cos(i)`. Without this, satellites in the same physical plane appear at different RAAN values due to epoch mismatch (RAAN precesses ~5-7°/day for Starlink orbits).
- **Controls**: Shell selector tabs
- **Overlay**: Dashed vertical lines at expected evenly-spaced plane positions
- **Tooltip**: Plane number, corrected RAAN angle, satellite count, actual gap vs expected spacing
- **Footnote**: RAAN corrected to common epoch via J2 precession model. Residual scatter indicates plane drift or maneuvers.

#### 7. ISL Coverage
- **Type**: Area chart (% over time)
- **Data**: `daily_snapshots.isl_operational_count / operational_count` per date (all shells combined). Tracks ISL-capable AND operational — orbit-raising satellites with laser hardware don't contribute to the mesh.
- **Overlay**: 50% threshold reference line
- **Tooltip**: Date, percentage, absolute count, month-over-month delta
- **Legend**: Explains the ISL heuristic by shell name (polar shells=always, 53° shell from 2022, 43° shell from 2023, 33° shell from 2024). Notes this is an approximation — the v1.0/v1.5 cutover wasn't clean, and failed laser terminals aren't detectable from TLE data.
- **Footnote**: ISL capability inferred from launch year + shell, not confirmed by SpaceX. Actual mesh connectivity depends on terminal health.

### Navigation

- Top bar has "← Back to Globe" link returning to `/`
- The globe view's HandoffPanel could link to `/fleet` for deeper analysis (future enhancement)

### Summary Strip

Five metric cards at the top, computed from **current-state propagation** (not epoch altitudes):

| Card | Value | Description |
|------|-------|-------------|
| Total Fleet | Count | All tracked Starlink objects (excluding decayed) |
| Operational | Count (green) | `status = 'operational'` — at target shell altitude |
| ISL Capable | Count (blue) | ISL-capable AND operational (mesh-contributing) |
| Orbit Raising | Count (yellow) | `status = 'raising'` — below target, consistently climbing over 3+ epochs |
| Deorbiting | Count (red) | `status = 'deorbiting'` — consistently descending over 3+ epochs at >1 km/day |

### Status Indicators (Top Bar)

- **TLE Age**: Time since last CelesTrak fetch (green if <6h, yellow if <24h, red if stale)
- **Last Ingest**: UTC timestamp of last database update
- **Records**: Total TLE snapshots in database
- **TLE Freshness**: "95% < 24h" — percentage of fleet with recent TLEs (surfaces staleness issue from maneuvering sats)

### Empty, Loading & Error States

- **Before first ingest**: Page shows a prompt to run `npm run ingest` with instructions
- **API routes with no data**: Return empty arrays (`[]`), not errors
- **Charts with no data**: Show centered "No data available" placeholder text
- **Loading**: Each chart panel shows a subtle pulsing skeleton while fetching
- **API errors**: Charts show "Failed to load" with a retry button
- **CelesTrak unreachable**: Top bar shows warning badge, uses cached data

### SSR Considerations

`FleetPage` and all chart components are client components (`'use client'`). The `src/app/fleet/page.tsx` server component dynamically imports `FleetPage` with SSR disabled (`next/dynamic`), matching the pattern used by the existing globe page. `recharts` requires a browser environment.

### Query Performance

The `daily_snapshots` table handles all time-series aggregation queries (growth, launches, ISL coverage), keeping them fast regardless of `tle_snapshots` size. Direct `tle_snapshots` queries (altitude distribution, satellite lifecycle, orbital planes) are always scoped by date or NORAD ID with indexed columns. The `/api/fleet/satellite/:noradId` endpoint limits results to 1,000 data points (downsampled if needed).

## Tech Stack

- **Database**: `better-sqlite3` (synchronous, fast, zero-config Node.js SQLite binding)
- **Charts**: `recharts` (React charting library, composable, good dark-theme support)
- **API**: Next.js API routes (server-side SQLite access)
- **Page**: Next.js page component at `src/app/fleet/page.tsx`
- **Ingestion**: Standalone Node.js script using `satellite.js` (already a project dependency) and `better-sqlite3`

## File Structure

```
data/
  fleet.db                    # SQLite database (gitignored)
  last-celestrak-response.json # Cached CelesTrak response (gitignored)
scripts/
  ingest-tles.ts              # TLE ingestion script
src/
  app/
    fleet/
      page.tsx                # Fleet monitor page
  components/
    fleet/
      FleetPage.tsx           # Main page layout
      SummaryStrip.tsx        # Top metric cards
      ConstellationGrowth.tsx # Chart 1
      AltitudeDistribution.tsx # Chart 2
      ShellFillRate.tsx       # Chart 3
      LaunchCadence.tsx       # Chart 4
      SatelliteLifecycle.tsx  # Chart 5
      OrbitalPlanes.tsx       # Chart 6
      IslCoverage.tsx         # Chart 7
      ChartPanel.tsx          # Shared panel wrapper (title, subtitle, footnote)
      FleetTooltip.tsx        # Shared tooltip component
  lib/
    fleet/
      db.ts                   # Database connection + query helpers (WAL mode init)
      queries.ts              # SQL query functions for each API route
      classify.ts             # Status classification (sliding window, eccentricity check)
      raan-correction.ts      # J2 precession correction for RAAN normalization
```

## Git Workflow

Work on a feature branch: `feat/fleet-monitor`

## Dependencies

New npm packages:
- `better-sqlite3` — SQLite binding for Node.js
- `@types/better-sqlite3` — TypeScript types
- `recharts` — React charting library

## Open Questions (Deferred)

- Historical backfill via Space-Track.org (requires user credentials)
- Linking from globe view to fleet page for specific satellites
- Server-side ingest scheduling: cron vs integrated into existing polling loop?
- Plane health heatmap: per-plane satellite counts (requires RAAN clustering into discrete planes)
- Sub-shell discrimination within 53° (480 km vs 550 km clusters) — may warrant splitting in future
