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
| altitude_km | REAL | SGP4 instantaneous altitude at TLE epoch (propagated via `satellite.js`) |
| launch_year | INTEGER | From international designator |
| launch_number | INTEGER | Launch sequence within year |
| shell_id | INTEGER | 0=33°, 1=43°, 2=53°, 3=70°, 4=97.6° (matches `SHELL_ALT_BANDS` index in `config.ts`) |
| is_operational | INTEGER | 1 if altitude within shell's operational band |
| is_isl_capable | INTEGER | 1 if matches ISL heuristic from `isl-capability.ts` |
| PRIMARY KEY | (norad_id, epoch_ts) | |

Indexes:
- `idx_epoch_ts` on `epoch_ts` — for time-range queries
- `idx_norad_epoch` on `(norad_id, epoch_ts)` — for per-satellite history
- `idx_shell_epoch` on `(shell_id, epoch_ts)` — for per-shell aggregation

#### `daily_snapshots` table

Materialized daily aggregates, one row per shell per day. Rebuilt on each ingest.

| Column | Type | Description |
|--------|------|-------------|
| date | TEXT | YYYY-MM-DD |
| shell_id | INTEGER | 0–4 |
| total_count | INTEGER | All tracked satellites in this shell |
| operational_count | INTEGER | At target altitude |
| isl_capable_count | INTEGER | Matches ISL heuristic |
| avg_altitude | REAL | Mean altitude (km) |
| min_altitude | REAL | Lowest altitude in shell |
| max_altitude | REAL | Highest altitude in shell |
| new_launches | INTEGER | Satellites first seen this day |
| deorbited | INTEGER | Satellites whose latest altitude is below shell `minAlt` and trending downward (altitude decreased between last two TLE epochs) |
| PRIMARY KEY | (date, shell_id) | |

### Ingestion Script

`scripts/ingest-tles.ts` — Node.js script, runnable via `npm run ingest`.

1. Fetch current Starlink TLEs from CelesTrak GP endpoint: `https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json` (OMM JSON format, no auth required)
2. Parse each record, extract orbital elements
3. Compute derived fields:
   - Altitude via SGP4 propagation to the TLE epoch using `satellite.js` (`sgp4(satrec, 0)` → ECI → geodetic → altitude). This matches the existing visualization's altitude computation and is consistent with `SHELL_ALT_BANDS` calibration. Do NOT use Kepler's third law on mean motion — those altitudes differ significantly from SGP4 instantaneous values.
   - Shell classification using inclination bands from `config.ts` (`SHELL_ALT_BANDS`)
   - Operational status using `isOperationalAltitude(inclination, altitude)` from `config.ts`
   - ISL capability using heuristic from `isl-capability.ts`
4. Upsert into `tle_snapshots` (INSERT OR IGNORE — same norad_id + epoch_ts = skip)
5. Rebuild `daily_snapshots` for affected dates
6. Log summary: new records inserted, total records, database size

The script can also be triggered from the server's existing polling loop (e.g., every 6 hours) alongside the existing TLE fetch. The ingest is idempotent — running it multiple times with the same data is a no-op.

### API Routes

All under `/api/fleet/`. Return JSON. Support `from` and `to` query params (ISO date strings) for time filtering.

| Route | Description | Source Table |
|-------|-------------|--------------|
| `GET /api/fleet/growth` | Daily constellation size by shell | `daily_snapshots` |
| `GET /api/fleet/altitudes?date=` | Altitude distribution snapshot (all sats, one day) | `tle_snapshots` |
| `GET /api/fleet/launches` | Launch cadence (new sats per month/quarter) | `daily_snapshots` |
| `GET /api/fleet/satellite/:noradId` | Individual satellite altitude history | `tle_snapshots` |
| `GET /api/fleet/shells` | Current shell summary stats | `daily_snapshots` (latest) |
| `GET /api/fleet/planes?shell=` | RAAN distribution for a shell | `tle_snapshots` (latest epoch per sat) |

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
- **Data**: Latest `tle_snapshots` per satellite, binned by altitude
- **Bars**: Colored by shell assignment
- **Tooltip**: Altitude range, shell, satellite count
- **Overlay**: Dashed vertical lines showing shell operational bands
- **Footnote**: Gaps between clusters indicate orbit-raising satellites

#### 3. Shell Fill Rate
- **Type**: Horizontal progress bars (one per shell)
- **Data**: Latest `daily_snapshots` operational count vs FCC target
- **Per-bar**: Shell color, name, metadata (purpose, altitude, plane count), operational/target count, percentage
- **Footnote**: Targets from FCC Gen1/Gen2 filings

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
- **Color coding**: Green = raising, blue = operational, yellow = in transit, red dashed = deorbiting
- **Overlay**: Horizontal band showing target altitude range
- **Tooltip**: Satellite name, NORAD ID, shell, current altitude, orbit-raise duration vs average

#### 6. Orbital Planes (RAAN)
- **Type**: Scatter plot (X = RAAN 0°–360°, Y = altitude deviation from shell mean)
- **Data**: Latest `tle_snapshots` per satellite, filtered by selected shell
- **Controls**: Shell selector tabs
- **Overlay**: Dashed vertical lines at expected evenly-spaced plane positions
- **Tooltip**: Plane number, RAAN angle, satellite count, actual gap vs expected spacing
- **Footnote**: RAAN precesses over time — snapshot represents current epoch

#### 7. ISL Coverage
- **Type**: Area chart (% over time)
- **Data**: `daily_snapshots.isl_capable_count / operational_count` per date (all shells combined)
- **Overlay**: 50% threshold reference line
- **Tooltip**: Date, percentage, absolute count, month-over-month delta
- **Legend**: Explains the ISL heuristic by shell name (polar shells=always, 53° shell from 2022, 43° shell from 2023, 33° shell from 2024)
- **Footnote**: ISL capability inferred from launch year + shell, not confirmed by SpaceX

### Navigation

- Top bar has "← Back to Globe" link returning to `/`
- The globe view's HandoffPanel could link to `/fleet` for deeper analysis (future enhancement)

### Summary Strip

Five metric cards at the top:

| Card | Value | Description |
|------|-------|-------------|
| Total Fleet | Count | All tracked NORAD objects |
| Operational | Count (green) | At target shell altitude |
| ISL Capable | Count (blue) | Laser inter-satellite links |
| Orbit Raising | Count (yellow) | Below shell `minAlt` and altitude trending upward (increased between last two TLE epochs) |
| Deorbiting | Count (red) | Below shell `minAlt` and altitude trending downward (decreased between last two TLE epochs) |

### Status Indicators (Top Bar)

- **TLE Age**: Time since last CelesTrak fetch (green if <6h, yellow if <24h, red if stale)
- **Last Ingest**: UTC timestamp of last database update
- **Records**: Total TLE snapshots in database

### Empty, Loading & Error States

- **Before first ingest**: Page shows a prompt to run `npm run ingest` with instructions
- **API routes with no data**: Return empty arrays (`[]`), not errors
- **Charts with no data**: Show centered "No data available" placeholder text
- **Loading**: Each chart panel shows a subtle pulsing skeleton while fetching
- **API errors**: Charts show "Failed to load" with a retry button

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
      db.ts                   # Database connection + query helpers
      queries.ts              # SQL query functions for each API route
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
- Shell target numbers: hardcode from FCC filings or make configurable?
- Server-side ingest scheduling: cron vs integrated into existing polling loop?
