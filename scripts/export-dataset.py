#!/usr/bin/env python3
"""
Export fleet.db SQLite tables to Parquet files for the HF dataset.
Produces two files:
  - tle_snapshots.parquet  (per-satellite orbital elements over time)
  - daily_snapshots.parquet (per-shell daily aggregates)

Usage: python scripts/export-dataset.py [--upload]
"""

import sqlite3
import sys
from pathlib import Path

import pandas as pd

DB_PATH = Path(__file__).parent.parent / "data" / "fleet.db"
OUT_DIR = Path(__file__).parent.parent / "data" / "dataset" / "data"

SHELL_NAMES = {
    0: "Shell 1 (33° / 328km)",
    1: "Shell 2 (43° / 340km)",
    2: "Shell 3 (53° / 550km)",
    3: "Shell 4 (70° / 570km)",
    4: "Shell 5 (97.6° / 560km)",
}


def export():
    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))

    # ── TLE snapshots ───────────────────────────────────────────────
    print("Exporting tle_snapshots...")
    df_tle = pd.read_sql_query(
        """
        SELECT
            norad_id,
            name,
            datetime(epoch_ts, 'unixepoch') as epoch_utc,
            inclination,
            raan,
            eccentricity,
            mean_motion,
            ndot as mean_motion_dot,
            altitude_km,
            launch_year,
            shell_id,
            status,
            is_isl_capable
        FROM tle_snapshots
        ORDER BY epoch_ts, norad_id
        """,
        conn,
    )
    df_tle["epoch_utc"] = pd.to_datetime(df_tle["epoch_utc"])
    df_tle["is_isl_capable"] = df_tle["is_isl_capable"].astype(bool)
    df_tle["shell_name"] = df_tle["shell_id"].map(SHELL_NAMES).fillna("Unknown")

    tle_path = OUT_DIR / "tle_snapshots.parquet"
    df_tle.to_parquet(tle_path, index=False, engine="pyarrow")
    size_mb = tle_path.stat().st_size / 1024 / 1024
    print(f"  {len(df_tle):,} rows → {tle_path} ({size_mb:.1f} MB)")

    # ── Daily snapshots ─────────────────────────────────────────────
    print("Exporting daily_snapshots...")
    df_daily = pd.read_sql_query(
        """
        SELECT
            date,
            shell_id,
            total_count,
            operational_count,
            raising_count,
            deorbiting_count,
            reentered_count,
            isl_operational_count,
            avg_altitude,
            min_altitude,
            max_altitude,
            new_launches,
            anomalous_count
        FROM daily_snapshots
        ORDER BY date, shell_id
        """,
        conn,
    )
    df_daily["date"] = pd.to_datetime(df_daily["date"])
    df_daily["shell_name"] = df_daily["shell_id"].map(SHELL_NAMES).fillna("Unknown")

    daily_path = OUT_DIR / "daily_snapshots.parquet"
    df_daily.to_parquet(daily_path, index=False, engine="pyarrow")
    size_mb = daily_path.stat().st_size / 1024 / 1024
    print(f"  {len(df_daily):,} rows → {daily_path} ({size_mb:.1f} MB)")

    # ── Latest per-satellite snapshot (for altitude distribution chart) ──
    print("Exporting latest_satellites...")
    df_latest = pd.read_sql_query(
        """
        SELECT t.norad_id, t.name, t.altitude_km, t.shell_id, t.status,
               t.inclination, t.raan, t.mean_motion, t.eccentricity,
               t.is_isl_capable, t.launch_year, t.epoch_ts
        FROM tle_snapshots t
        INNER JOIN (
            SELECT norad_id, MAX(epoch_ts) as max_epoch
            FROM tle_snapshots
            GROUP BY norad_id
        ) latest ON t.norad_id = latest.norad_id AND t.epoch_ts = latest.max_epoch
        ORDER BY t.shell_id, t.altitude_km
        """,
        conn,
    )
    df_latest["is_isl_capable"] = df_latest["is_isl_capable"].astype(bool)
    df_latest["shell_name"] = df_latest["shell_id"].map(SHELL_NAMES).fillna("Unknown")

    latest_path = OUT_DIR / "latest_satellites.parquet"
    df_latest.to_parquet(latest_path, index=False, engine="pyarrow")
    size_mb = latest_path.stat().st_size / 1024 / 1024
    print(f"  {len(df_latest):,} rows → {latest_path} ({size_mb:.1f} MB)")

    conn.close()

    # ── Summary ─────────────────────────────────────────────────────
    date_range = f"{df_tle['epoch_utc'].min().date()} to {df_tle['epoch_utc'].max().date()}"
    n_sats = df_tle["norad_id"].nunique()
    print(f"\nDataset spans {date_range}")
    print(f"  {n_sats:,} unique satellites")
    print(f"  {len(df_tle):,} TLE snapshots")
    print(f"  {len(df_daily):,} daily aggregates")

    # ── Upload ──────────────────────────────────────────────────────
    if "--upload" in sys.argv:
        import subprocess

        print("\nUploading to HF dataset...")
        subprocess.run(
            [
                "hf",
                "upload",
                "juliensimon/starlink-fleet-data",
                str(OUT_DIR),
                "data",
                "--repo-type",
                "dataset",
            ],
            check=True,
        )
        print("Uploaded to juliensimon/starlink-fleet-data")


if __name__ == "__main__":
    export()
