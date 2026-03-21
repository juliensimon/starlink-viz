# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server** (custom HTTP + WebSocket + Next.js): `npm run dev`
- **Dev Next.js only** (no backend polling): `npm run dev:next`
- **Build**: `npm run build`
- **Start production**: `npm run start`
- **Run all tests**: `npm run test` (vitest)
- **Run single test**: `npx vitest run src/__tests__/coordinates.test.ts`
- **Update ground stations data**: `npm run update-gs`

## Architecture

Real-time 3D Starlink satellite visualization built on Next.js 16, React Three Fiber, and a custom Node.js server.

### Server (`server.ts`)

Custom HTTP server wrapping Next.js that handles:
- **gRPC client** (`src/lib/grpc/`) — connects to a Starlink dish at `192.168.100.1:9200` (configurable via `DISH_ADDRESS`) to poll status and history
- **WebSocket server** (`src/lib/websocket/server.ts`) — broadcasts dish telemetry, handoff events, and event log messages to all connected clients
- **Demo mode** — auto-detected when no dish is reachable; uses mock data generators from `src/lib/grpc/mock-data.ts`. Controllable via `DEMO_MODE` env var (`true`/`false`/`auto`) and `/api/mode` endpoint
- **Polling loops** — status (1s), history (5s), PoP detection (10s), traceroute (60s)

### Frontend

Single-page app with a full-viewport 3D canvas and HUD overlay:

- **3D Scene** (`src/components/scene/`) — React Three Fiber canvas with Globe, Satellites (instanced mesh), GpsSatellites, Sun, Moon, DishMarker, ConnectionBeam, GroundStations (star-shaped markers, operational/planned), Atmosphere, and SceneSetup (camera controls, starfield)
- **HUD** (`src/components/hud/`):
  - `StatusBar` — connection state, uptime, quality, firmware, GPS
  - `TelemetryPanel` — sparkline charts for ping, DL, UL, SNR
  - `SatelliteInfoPanel` — satellite link info, gateway, PoP, route type (Direct/ISL), latency confidence indicator
  - `HandoffPanel` — titled "Starlink Network": LIVE/TLE/WS indicators, per-shell satellite stats (operational/total/%), gateway counts, handoff tracking
  - `EventLog`, `ViewControls`, `ColorLegend`
- **WebSocket client** (`src/components/WebSocketManager.tsx`) — receives messages and dispatches to stores

### State Management

- `src/stores/app-store.ts` — Zustand store for UI state (selected satellite, view mode, demo mode, altitude filter, ISL prediction, demo location)
- `src/stores/telemetry-store.ts` — Zustand store for dish telemetry data and geometric latency (for cross-validation)

### Satellite Propagation

- `src/lib/satellites/propagator.ts` — SGP4 orbital propagation using `satellite.js`, writes positions into Float32Array for instanced rendering
- `src/lib/satellites/tle-fetcher.ts` — fetches TLE data via API routes
- `src/lib/satellites/satellite-store.ts` — manages satellite records, position buffers, full unfiltered catalog (inclinations, altitudes, launch years), RAAN/ISL arrays, current route
- `src/lib/satellites/isl-capability.ts` — ISL detection heuristic (launch year + inclination) and RAAN parsing from TLE
- `src/lib/satellites/isl-graph.ts` — CSR-encoded neighbor graph for ISL-capable satellites (4 terminals: 2 in-plane, 2 cross-plane), rebuilt every 30s
- `src/hooks/useSatellites.ts` — React hook driving propagation on animation frames

### Per-Shell Altitude Bands (`src/lib/config.ts`)

Operational status is determined by per-shell altitude bands derived from SGP4 instantaneous altitudes (not FCC filings or mean-motion — these can differ by 100+ km). The `isOperationalAltitude(inclination, altitude)` function checks whether a satellite is at its shell's operational altitude. Bands should be periodically revalidated against live TLE data as the constellation evolves.

### ISL Routing & PoP-Constrained Gateway Selection

The app models inter-satellite laser links (ISL) for realistic route prediction:

- **ISL capability** (`isl-capability.ts`) — heuristic: polar shells always, 53° from 2022, 43° from 2023, 33° from 2024
- **ISL graph** (`isl-graph.ts`) — CSR neighbor graph, 4 terminals per sat (2 in-plane, 2 cross-plane), polar exclusion at ±70° latitude
- **Pathfinder** (`src/lib/utils/isl-pathfinder.ts`) — PoP-constrained GS selection with line-of-sight check. ISL routes only explored when no valid GS is directly visible (mandatory ISL). Routes held for 30s with LoS validity check
- **Backhaul** (`src/lib/utils/backhaul-latency.ts`) — per-gateway RTT estimate from haversine distance to nearest IXP at 0.67c with 1.4× fiber route factor
- **PoP constraint** — detected via rDNS on public IP (`/api/pop`), stored in satellite-store, limits GS candidates to those within 1,500km of the PoP
- **Latency model** — speed-of-light geometry + 6ms base processing RTT + 0.3ms OEO per ISL hop + per-GS backhaul
- **Route log** — decisions written to `isl-route.log` and `window.__ISL_ROUTE_LOG` for debugging
- **Toggle** — `islPrediction` in app-store, green pill-switch in ViewControls
- **Demo locations** — 5 remote locations (Iceland Gap, N/Mid Atlantic, Gulf of Mexico, Celtic Sea) where ISL is mandatory. Dropdown in ViewControls (demo mode only). Iceland Gap is the default. Selecting a location overrides dish position, satellite selection, and PoP constraint
- **Route log** — decisions written to `isl-route.log` and `window.__ISL_ROUTE_LOG` for debugging

### Ground Stations (HF dataset)

Loaded exclusively from HF dataset [`juliensimon/starlink-ground-stations`](https://huggingface.co/datasets/juliensimon/starlink-ground-stations) (gateways config). `GROUND_STATIONS` starts empty and is populated via `refreshGroundStations()`: server-side fetches from HF API directly, client-side fetches from `/api/ground-stations`. All derived data (3D positions in `GroundStations.tsx`/`ConnectionBeam.tsx`, backhaul RTT, ISL pathfinder arrays) uses lazy recomputation via `groundStationsVersion` counter. Planned stations are rendered with reduced opacity and **excluded from gateway selection routing**.

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

### Key Conventions

- Path alias: `@/` maps to `src/`
- The 3D scene uses a unit sphere for Earth (radius = 1); satellite altitude is mapped as `1 + altKm / 6371`
- Coordinate system: X = cos(lat)cos(lon), Y = sin(lat), Z = -cos(lat)sin(lon)
- 5 orbital shells color-coded by inclination: 33° (gold), 43° (orange), 53° (blue), 70° (teal), 97.6° (pink-red). Classification in `getDimColor()` in `Satellites.tsx` must stay in sync with `shellIndex()` in `HandoffPanel.tsx` and `SHELL_ALT_BANDS` in `config.ts`
- WebSocket protocol uses typed messages (`status`, `history`, `handoff`, `event`) defined in `src/lib/grpc/types.ts` with type guards in `src/lib/websocket/protocol.ts`
- Dish location configured via `NEXT_PUBLIC_DISH_LAT` and `NEXT_PUBLIC_DISH_LON` env vars (defaults to 48.910, 1.910)
- Scene is dynamically imported with SSR disabled (`next/dynamic`)
- React strict mode is off (`reactStrictMode: false` in next.config.ts)
- Tests live in `src/__tests__/` and run in Node environment (vitest)
- CelesTrak "Starlink" group may include Starshield/military objects alongside commercial satellites
