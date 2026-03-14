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

- **3D Scene** (`src/components/scene/`) — React Three Fiber canvas with Globe, Satellites (instanced mesh), GpsSatellites, DishMarker, ConnectionBeam, GroundStations, Atmosphere, Terminator (day/night line), and SceneSetup (camera controls, starfield)
- **HUD** (`src/components/hud/`) — StatusBar (system status), TelemetryPanel (charts), SatelliteInfoPanel (satellite link, gateway, PoP, confidence), HandoffPanel (Starlink Network stats, shell info, handoffs), EventLog, ViewControls, ColorLegend. Overlaid on the 3D scene
- **WebSocket client** (`src/components/WebSocketManager.tsx`) — receives messages and dispatches to stores

### State Management

- `src/stores/app-store.ts` — Zustand store for UI state (selected satellite, view mode, demo mode, altitude filter)
- `src/stores/telemetry-store.ts` — Zustand store for dish telemetry data received via WebSocket

### Satellite Propagation

- `src/lib/satellites/propagator.ts` — SGP4 orbital propagation using `satellite.js`, writes positions into Float32Array for instanced rendering
- `src/lib/satellites/tle-fetcher.ts` — fetches TLE data via API routes
- `src/lib/satellites/satellite-store.ts` — manages satellite records and position buffers
- `src/hooks/useSatellites.ts` — React hook driving propagation on animation frames

### Key Conventions

- Path alias: `@/` maps to `src/`
- The 3D scene uses a unit sphere for Earth (radius = 1); satellite altitude is mapped as `1 + altKm / 6371`
- Coordinate system: X = cos(lat)cos(lon), Y = sin(lat), Z = -cos(lat)sin(lon)
- WebSocket protocol uses typed messages (`status`, `history`, `handoff`, `event`) defined in `src/lib/grpc/types.ts` with type guards in `src/lib/websocket/protocol.ts`
- Dish location configured via `NEXT_PUBLIC_DISH_LAT` and `NEXT_PUBLIC_DISH_LON` env vars (defaults to 48.910, 1.910)
- Scene is dynamically imported with SSR disabled (`next/dynamic`)
- React strict mode is off (`reactStrictMode: false` in next.config.ts)
- Tests live in `src/__tests__/` and run in Node environment (vitest)
