---
license: cc-by-4.0
task_categories:
  - time-series-forecasting
  - tabular-regression
tags:
  - space
  - starlink
  - satellites
  - orbital-mechanics
  - tle
  - spacex
size_categories:
  - 10M<n<100M
configs:
  - config_name: tle_snapshots
    data_files:
      - split: train
        path: data/tle_snapshots.parquet
  - config_name: daily_snapshots
    data_files:
      - split: train
        path: data/daily_snapshots.parquet
  - config_name: latest_satellites
    data_files:
      - split: train
        path: data/latest_satellites.parquet
---

# Starlink Fleet Historical Dataset

Complete orbital element history for the SpaceX Starlink satellite constellation, from May 2019 to present.

## Quick Start

```python
from datasets import load_dataset

# Per-satellite orbital snapshots (millions of rows)
tle = load_dataset("juliensimon/starlink-fleet-data", "tle_snapshots")

# Daily per-shell aggregates (compact summary)
daily = load_dataset("juliensimon/starlink-fleet-data", "daily_snapshots")

# Latest snapshot per satellite (one row per sat)
latest = load_dataset("juliensimon/starlink-fleet-data", "latest_satellites")
```

## Dataset Description

This dataset tracks every Starlink satellite's orbital parameters over time, enabling analysis of:
- **Constellation growth**: from 60 satellites in 2019 to 9,000+ today
- **Orbit raising campaigns**: newly launched satellites climbing from ~300km to operational altitude (~550km)
- **Deorbiting events**: end-of-life satellites descending for controlled reentry
- **Shell deployment**: how SpaceX fills 5 orbital shells at different inclinations
- **ISL rollout**: the progression of inter-satellite laser link capability across the fleet

## How It Was Built

### Data Collection Pipeline

```
Space-Track.org (GP_History API)          CelesTrak (current OMM JSON)
        │  historical TLEs                        │  daily TLEs
        │  monthly batch queries                  │  single fetch
        ▼                                         ▼
┌─────────────────────────────────────────────────────┐
│              Ingestion Pipeline                      │
│  scripts/backfill-spacetrack.ts (historical)         │
│  scripts/ingest-tles.ts (daily updates)              │
│                                                      │
│  For each TLE record:                                │
│  1. Parse OMM fields (NORAD ID, epoch, elements)     │
│  2. Compute altitude from mean motion (Kepler's 3rd) │
│  3. Assign to orbital shell by inclination           │
│  4. Classify status (operational/raising/deorbiting)  │
│  5. Determine ISL capability (launch year heuristic)  │
│  6. Insert into SQLite database                       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           Daily Snapshot Rebuild                      │
│  For each date with TLE data:                        │
│  - Find latest TLE per satellite ON OR BEFORE date   │
│  - Aggregate by shell: counts, altitudes, ISL stats  │
│  - Track new launches (first TLE appearance)         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           Export (scripts/export-dataset.py)          │
│  SQLite → Parquet via pandas + pyarrow               │
│  - tle_snapshots.parquet (all per-satellite records) │
│  - daily_snapshots.parquet (per-shell daily rollups) │
│  - latest_satellites.parquet (latest per satellite)  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
              HF Dataset (this repo)
```

### Historical Backfill

The bulk of the data was collected from [Space-Track.org](https://www.space-track.org/)'s yearly TLE bulk exports (zip files containing raw two-line element sets for all tracked objects). The ingestion script (`scripts/ingest-bulk-zip.ts`) streams through each zip, filters for known Starlink NORAD IDs, parses TLE fields, and inserts into the database. Incremental updates use Space-Track's `GP_History` API (`scripts/backfill-spacetrack.ts`) and CelesTrak's current OMM endpoint (`scripts/ingest-tles.ts`).

- **May–Oct 2019**: queried by international designator (`OBJECT_ID/2019-029~~`) because the first 60 Starlink satellites were cataloged as "TBA - TO BE ASSIGNED" before receiving STARLINK-XX names
- **Nov 2019 onwards**: filtered by `OBJECT_NAME/STARLINK~~` wildcard or known NORAD IDs
- **Known gap**: Jan–Feb 2026 (between bulk export coverage and CelesTrak daily ingestion)

### Satellite Classification

Each TLE record is enriched with derived fields not present in the raw orbital elements:

**Altitude** — computed from mean motion via Kepler's third law: `a = (μ/n²)^(1/3)`, then `alt = a(1-e) - R_earth`. For Starlink's near-circular orbits (eccentricity < 0.001), this gives perigee altitude within ~1 km of SGP4-propagated values.

**Shell assignment** — based on inclination ranges matching SpaceX's FCC filings:
| Shell | Inclination range | Target altitude |
|-------|-------------------|-----------------|
| 0 | < 38° | 525 km (33° shell) |
| 1 | 38°–48° | 540 km (43° shell) |
| 2 | 48°–60° | 550 km (53° shell) |
| 3 | 60°–80° | 570 km (70° shell) |
| 4 | > 80° | 560 km (97.6° shell) |

**Status** — classified using altitude history (requires 3+ data points):
- `operational`: altitude within shell's operational band (460–570 km, varies by shell)
- `raising`: below target by >20 km AND altitude increasing over last 3 observations
- `deorbiting`: below target AND altitude decreasing >1 km/day
- `decayed`: altitude < 250 km with stale epoch (>14 days), or altitude < 0
- `anomalous`: eccentricity > 0.005 (unusual for Starlink)
- `unknown`: insufficient history to classify

**ISL capability** — heuristic based on launch year and shell:
- 53° and polar shells: ISL from 2022+ (v1.5 satellites with laser terminals)
- 43° shell: ISL from 2023+ (v2 Mini with 4 laser terminals)
- 33° shell: ISL from 2024+ (all future launches)
- Note: polar sats launched in 2021 were v1.0 WITHOUT lasers

### Daily Snapshot Aggregation

The `daily_snapshots` table is rebuilt from `tle_snapshots` for each date. For a given date, it finds the most recent TLE for each satellite **on or before** that date (not future data), then aggregates per shell. This means historical snapshots accurately reflect the constellation state at that point in time — a satellite launched in 2023 does not appear in a 2019 snapshot.

### Tables

#### `tle_snapshots` — Per-satellite orbital elements

| Column | Type | Description |
|--------|------|-------------|
| `norad_id` | int | NORAD catalog number (unique satellite ID) |
| `name` | string | Satellite name (e.g., STARLINK-1234) |
| `epoch_utc` | datetime | TLE epoch timestamp |
| `inclination` | float | Orbital inclination (degrees) |
| `raan` | float | Right ascension of ascending node (degrees) |
| `eccentricity` | float | Orbital eccentricity |
| `mean_motion` | float | Mean motion (revolutions/day) |
| `mean_motion_dot` | float | First derivative of mean motion (drag indicator) |
| `altitude_km` | float | Derived perigee altitude (km) |
| `launch_year` | int | Year of launch |
| `shell_id` | int | Orbital shell assignment (0-4) |
| `shell_name` | string | Human-readable shell name |
| `status` | string | Satellite status: operational, raising, deorbiting, decayed, anomalous, unknown |
| `is_isl_capable` | bool | Whether the satellite has inter-satellite laser links |

#### `daily_snapshots` — Per-shell daily aggregates

| Column | Type | Description |
|--------|------|-------------|
| `date` | date | Snapshot date |
| `shell_id` | int | Orbital shell (0-4) |
| `shell_name` | string | Human-readable shell name |
| `total_count` | int | Total satellites in shell |
| `operational_count` | int | Satellites at operational altitude |
| `raising_count` | int | Satellites climbing to operational altitude |
| `deorbiting_count` | int | Satellites descending (>1 km/day) |
| `reentered_count` | int | Satellites that have reentered |
| `isl_operational_count` | int | ISL-capable satellites at operational altitude |
| `avg_altitude` | float | Mean altitude across shell (km) |
| `min_altitude` | float | Lowest satellite in shell (km) |
| `max_altitude` | float | Highest satellite in shell (km) |
| `new_launches` | int | Newly cataloged satellites |
| `anomalous_count` | int | Satellites with unusual orbits (e > 0.005) |

#### `latest_satellites` — Most recent snapshot per satellite

One row per satellite with its latest known orbital parameters. Useful for current constellation analysis without scanning the full history.

| Column | Type | Description |
|--------|------|-------------|
| `norad_id` | int | NORAD catalog number |
| `name` | string | Satellite name |
| `altitude_km` | float | Current altitude (km) |
| `shell_id` | int | Orbital shell (0-4) |
| `shell_name` | string | Human-readable shell name |
| `status` | string | Current status |
| `inclination` | float | Orbital inclination (degrees) |
| `raan` | float | Right ascension of ascending node |
| `mean_motion` | float | Revolutions per day |
| `eccentricity` | float | Orbital eccentricity |
| `is_isl_capable` | bool | Has laser inter-satellite links |
| `launch_year` | int | Year of launch |
| `epoch_ts` | int | Unix timestamp of latest TLE epoch |

### Orbital Shells

| Shell | Inclination | Target Altitude | Description |
|-------|-------------|-----------------|-------------|
| 0 | 33° | 328 km | Newest shell, lowest altitude |
| 1 | 43° | 340 km | Mid-latitude coverage |
| 2 | 53° | 550 km | Primary shell, largest population |
| 3 | 70° | 570 km | High-latitude coverage |
| 4 | 97.6° | 560 km | Sun-synchronous polar orbit |

## Data Sources & Credits

- **Orbital elements**: [Space-Track.org](https://www.space-track.org/) — operated by the **18th Space Defense Squadron, United States Space Force**. Historical GP data accessed via the `GP_History` API class. Free registration required. All orbital element data originates from the US Space Surveillance Network.

- **Current TLE updates**: [CelesTrak](https://celestrak.org/) — Dr. T.S. Kelso's service providing redistributed NORAD two-line element sets.

- **Satellite classification** (shell assignment, ISL capability, operational status): derived by the [Starlink Mission Control](https://huggingface.co/spaces/juliensimon/starlink-mission-control) visualization app using SGP4 orbital mechanics and publicly available launch manifest data.

## Related Resources

- **Live 3D visualization**: [Starlink Mission Control on HF Spaces](https://huggingface.co/spaces/juliensimon/starlink-mission-control) — real-time 3D globe with satellite tracking, ground station routing, and fleet analytics
- **Source code & docs**: [GitHub: juliensimon/starlink-viz](https://github.com/juliensimon/starlink-viz)

## License

This dataset is released under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). Orbital element data is sourced from the US government (public domain) via Space-Track.org and CelesTrak.

## Citation

```bibtex
@dataset{starlink_fleet_data,
  title={Starlink Fleet Historical Dataset},
  author={Julien Simon},
  year={2026},
  url={https://huggingface.co/datasets/juliensimon/starlink-fleet-data},
  note={Orbital elements from Space-Track.org (18th Space Defense Squadron, USSF)}
}
```
