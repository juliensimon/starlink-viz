# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server** (custom HTTP + WebSocket + Next.js): `npm run dev`
- **Dev Next.js only** (no backend polling): `npm run dev:next`
- **Build**: `npm run build`
- **Start production**: `npm run start`
- **Run all tests**: `npm run test` (vitest)
- **Run single test**: `npx vitest run src/__tests__/coordinates.test.ts`
- **Update ground stations data**: `npm run update-gs` (multi-source: starlinkinsider.com + starlink.sx + PoP list)
- **Type check**: `npx tsc --noEmit` (runs in CI before tests)
- No linter or formatter is configured

## Architecture

Real-time 3D Starlink satellite visualization built on Next.js 16, React Three Fiber, and a custom Node.js server.

### Server (`server.ts`)

Custom HTTP server wrapping Next.js that handles:
- **gRPC client** (`src/lib/grpc/`) — connects to a Starlink dish at `192.168.100.1:9200` (configurable via `DISH_ADDRESS`) to poll status and history
- **WebSocket server** (`src/lib/websocket/server.ts`) — broadcasts dish telemetry, handoff events, and event log messages to all connected clients
- **Demo mode** — auto-detected when no dish is reachable; uses mock data generators from `src/lib/grpc/mock-data.ts`. Controllable via `DEMO_MODE` env var (`true`/`false`/`auto`) and `/api/mode` endpoint
- **Polling loops** — status (1s), history (5s), PoP detection (10s), traceroute (60s)

### API Routes (`src/app/api/`)

- `/api/tle` — CelesTrak Starlink TLE data (6h in-memory cache)
- `/api/tle-gps` — GPS constellation TLE data
- `/api/ground-stations` — gateway catalog from HF dataset `juliensimon/starlink-ground-stations` (via `refreshGroundStations()`)
- `/api/pop` — public IP + rDNS PoP city detection (5m cache)
- `/api/isl-log` — ISL route decision log (GET last 100 lines / POST append)
- `/api/mode` — GET/POST runtime demo/live mode switching (handled in `server.ts`, not Next.js)

### Frontend

Single-page app with a full-viewport 3D canvas and HUD overlay:

- **3D Scene** (`src/components/scene/`) — React Three Fiber canvas with two view modes:
  - `SatellitePropagator` — headless SGP4 propagation, always mounted, writes positions to shared Float32Array in satellite-store
  - `ConnectionBeam` — always mounted (drives satellite selection, handovers, az/el updates); visuals hidden in sky mode via `<group visible={false}>`
  - **Space view**: Globe, Satellites (instanced mesh renderer, reads from satellite-store), GpsSatellites, Sun, Moon, DishMarker, GroundStations, Atmosphere, SceneSetup, SatelliteTooltip
  - **Sky view** (`SkyView.tsx` → `src/components/scene/sky/`):
    - `SkyDomeCamera` — Stellarium-style horizon camera, OrbitControls with 360° azimuth and zenith reach
    - `SkyEnvironment` — ground plane, sun-aware sky gradient (day/twilight/night), horizon ring with compass ticks
    - `SkyGrid` — elevation circles at 30°/60°, azimuth lines every 45°, Billboard cardinal labels
    - `SkyConstellations` — 88 IAU constellation stick figures (LineSegments) + Billboard name labels, RA/Dec→Az/El
    - `SkySatellites` — instanced mesh with az/el dome projection, sun shadow coloring (sunlit=bright, shadow=10%)
    - `SkyStars` — ~500 reference stars (Points with shader), RA/Dec→Az/El via GMST, Billboard name labels
    - `SkyBeam` — glow sprites + halo ring on connected satellite, follows handovers
    - `SkyTooltip` — screen-space nearest-neighbor picking for satellites (az/el, shell, sunlit) and stars (name, magnitude)
    - `SkyTrajectory` — ±5min trajectory arc on hover via SGP4 `propagatePosition()`
- **HUD** (`src/components/hud/`):
  - `StatusBar` — connection state, uptime, quality, firmware, GPS
  - `TelemetryPanel` — sparkline charts for ping, DL, UL, SNR
  - `SatelliteInfoPanel` — satellite link info, gateway, PoP, route type (Direct/ISL), latency confidence indicator
  - `HandoffPanel` — titled "Starlink Network": LIVE/TLE/WS indicators, per-shell satellite stats (operational/total/%), gateway counts, handoff tracking
  - `SkyHud` — sky view stats: sun elevation, satellite counts (sunlit/shadow), UTC time, daytime warning
  - `EventLog`, `ViewControls` (Space/Sky toggle, demo/live, rotate, altitude filter, ISL), `ColorLegend`
- **WebSocket client** (`src/components/WebSocketManager.tsx`) — receives messages and dispatches to stores

### State Management

- `src/stores/app-store.ts` — Zustand store for UI state (selected satellite, view mode, demo mode, altitude filter, ISL prediction, demo location)
- `src/stores/telemetry-store.ts` — Zustand store for dish telemetry data and geometric latency (for cross-validation)

### Satellite Propagation

- `src/lib/satellites/propagator.ts` — SGP4 orbital propagation using `satellite.js`, writes positions into Float32Array for instanced rendering. Includes `propagatePosition()` for single-satellite 3D position queries (used by trajectory arcs)
- `src/lib/satellites/tle-fetcher.ts` — fetches TLE data via API routes
- `src/lib/satellites/satellite-store.ts` — manages satellite records, position buffers, full unfiltered catalog (inclinations, altitudes, launch years), RAAN/ISL arrays, current route
- `src/lib/satellites/isl-capability.ts` — ISL detection heuristic (launch year + inclination) and RAAN parsing from TLE
- `src/lib/satellites/isl-graph.ts` — CSR-encoded neighbor graph for ISL-capable satellites (4 terminals: 2 in-plane, 2 cross-plane), rebuilt every 30s
- `src/hooks/useSatellites.ts` — React hook for TLE fetching
- `src/components/scene/SatellitePropagator.tsx` — headless component that owns propagation loop; always mounted regardless of camera mode; both Space and Sky views read from the shared positionsArray

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

### Ground Stations (HF dataset)

Loaded exclusively from HF dataset [`juliensimon/starlink-ground-stations`](https://huggingface.co/datasets/juliensimon/starlink-ground-stations) (gateways config). `GROUND_STATIONS` starts empty and is populated via `refreshGroundStations()`: server-side fetches from HF API directly, client-side fetches from `/api/ground-stations`. All derived data (3D positions in `GroundStations.tsx`/`ConnectionBeam.tsx`, backhaul RTT, ISL pathfinder arrays) uses lazy recomputation via `groundStationsVersion` counter. Stations have `type` field (`'gateway'` | `'pop'`) and `status` field (`'operational'` | `'planned'`). Planned stations are rendered with reduced opacity. Both planned and PoP entries are **excluded from gateway selection routing** in `isl-pathfinder.ts`.

The offline update script (`npm run update-gs`) reconciles data from multiple sources (starlinkinsider.com, starlink.sx, PoP list) and writes to `data/ground-stations.json` as a backup. Runtime loading uses HF exclusively.

**Auto-update workflow** (`.github/workflows/update-ground-stations.yml`): runs weekly Monday 06:00 UTC, fetches from all sources, reconciles (name normalization, coordinate dedup within 5km, status merge, sanity checks), runs tests, and opens a PR if data changed. Uses `data/ground-stations-meta.json` for `lastSeen` tracking (gitignored).

### Fleet Monitor (`/fleet`)

Separate page tracking Starlink constellation health over time using NORAD TLE data.

- **Database**: `data/fleet.db` (SQLite, gitignored) — `tle_snapshots` (per-satellite per-epoch) and `daily_snapshots` (materialized daily aggregates per shell)
- **Ingestion**: `npm run ingest` fetches from CelesTrak, propagates via SGP4, classifies status, persists to SQLite
- **Status classification** (`src/lib/fleet/classify.ts`) — sliding window of 3+ TLE epochs: `operational`, `raising`, `deorbiting`, `decayed`, `anomalous`, `unknown`
- **API routes**: `/api/fleet/{growth,shells,altitudes,launches,satellite/[noradId],planes,kpis,refresh,search,vintage}`
- **Charts** (`src/components/fleet/`) — 9 recharts panels: Constellation Growth, Altitude Distribution, Shell Fill Rate, Launch Cadence, Satellite Lifecycle, Orbital Planes (RAAN with J2 correction), ISL Coverage, Launch Year Vintage, Shell Filling Timeline
- **RAAN correction** (`src/lib/fleet/raan-correction.ts`) — J2 precession correction to common reference epoch for orbital plane analysis
- **Shell targets** (`SHELL_TARGETS` in `config.ts`) — FCC-authorized constellation sizes per shell
- **Filtering**: Only `STARLINK-\d+` names ingested (rejects Starshield, debris, TBA objects)

### Sky View Utilities

- `src/lib/utils/observer-frame.ts` — parameterized ENU (East-North-Up) frame from lat/lon, with `computeAzElFrom()` and `azElToDirection3D()`. Handles pole degeneracy with X-axis fallback
- `src/lib/utils/sun-shadow.ts` — cylindrical Earth shadow model: `isSatelliteSunlit()` and `isSunBelowHorizon()` for observer darkness detection
- `src/lib/utils/star-coordinates.ts` — RA/Dec (J2000) to Az/El horizontal coordinate transform using GMST from `satellite.gstime()`
- `src/lib/utils/shell-colors.ts` — shared `getDimColor()` extracted from Satellites.tsx, used by both Space and Sky view renderers
- `src/data/bright-stars.ts` — embedded catalog of ~500 stars (mag ≤ 4.0) with J2000 RA/Dec, magnitude, B-V color index
- `src/data/constellations.ts` — 88 IAU constellation stick figures with line segment coordinates and label positions

### Key Conventions

- Path alias: `@/` maps to `src/`
- The 3D scene uses a unit sphere for Earth (radius = 1); satellite altitude is mapped as `1 + altKm / 6371`
- Coordinate system: X = cos(lat)cos(lon), Y = sin(lat), Z = -cos(lat)sin(lon)
- 5 orbital shells color-coded by inclination: 33° (gold), 43° (orange), 53° (blue), 70° (teal), 97.6° (pink-red). Classification in `getDimColor()` in `src/lib/utils/shell-colors.ts` must stay in sync with `shellIndex()` in `HandoffPanel.tsx` and `SHELL_ALT_BANDS` in `config.ts`
- Camera mode toggled via `cameraMode` ('space' | 'sky') in app-store. Space/Sky toggle in ViewControls. `SatellitePropagator` and `ConnectionBeam` always mounted; visual components conditionally rendered
- WebSocket protocol uses typed messages (`status`, `history`, `handoff`, `event`) defined in `src/lib/grpc/types.ts` with type guards in `src/lib/websocket/protocol.ts`
- Dish location configured via `NEXT_PUBLIC_DISH_LAT` and `NEXT_PUBLIC_DISH_LON` env vars (defaults to 48.910, 1.910)
- Scene is dynamically imported with SSR disabled (`next/dynamic`)
- React strict mode is off (`reactStrictMode: false` in next.config.ts)
- Tests live in `src/__tests__/` and run in Node environment (vitest)
- CelesTrak "Starlink" group may include Starshield/military objects alongside commercial satellites

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISH_ADDRESS` | `192.168.100.1:9200` | Starlink dish gRPC endpoint |
| `DEMO_MODE` | `auto` | `true`/`false`/`auto` — auto-detects dish availability |
| `NEXT_PUBLIC_DISH_LAT` | `48.910` | Dish latitude for satellite/sky calculations |
| `NEXT_PUBLIC_DISH_LON` | `1.910` | Dish longitude |
| `STATUS_POLL_MS` | `1000` | Dish status polling interval |
| `HISTORY_POLL_MS` | `5000` | Telemetry history polling interval |
| `POP_POLL_MS` | `10000` | PoP detection polling interval |
| `TELEMETRY_LOG_EVERY` | `5` | Log to event log every Nth status poll |

### CI

- **CI** (`.github/workflows/ci.yml`): `tsc --noEmit` → `npm test` → `npm run build` on Node 20+22, triggered on push/PR to master
- **Ground station updates** (`.github/workflows/update-ground-stations.yml`): weekly Monday 06:00 UTC + manual dispatch. Fetches sources → reconciles → tests → opens PR via `peter-evans/create-pull-request`
