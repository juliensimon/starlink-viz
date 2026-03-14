# starlink-viz

Real-time 3D Starlink satellite tracker and mission control dashboard. Track every satellite in the SpaceX Starlink constellation, monitor live dish telemetry, visualize ground stations, and watch satellite handoffs — all computed from publicly available data. Built with Next.js, React Three Fiber, and Three.js.

![CI](https://github.com/juliensimon/starlink-viz/actions/workflows/ci.yml/badge.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Three.js](https://img.shields.io/badge/Three.js-0.183-049EF4)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![satellite.js](https://img.shields.io/badge/SGP4-satellite.js-orange)
![Satellites](https://img.shields.io/badge/satellites-7%2C500%2B-blueviolet)
![Ground Stations](https://img.shields.io/badge/gateways-204-ff9933)
![License](https://img.shields.io/badge/license-MIT-green)

![Starlink Viz Demo](docs/starlink-viz.gif)

## What it does

- **7,500+ Starlink satellites** propagated in real time using SGP4 orbital mechanics across 5 orbital shells
- **GPS constellation** tracked alongside Starlink with hover identification
- **Live dish telemetry** from a real Starlink dish via gRPC (or demo mode with simulated data)
- **Astronomically accurate Sun and Moon** with real-time positioning, lens flare, and natural lunar phases
- **Satellite handoff tracking** — monitors when your dish switches between satellites
- **204 ground stations** from FCC/international filings, with operational/planned status
- **Connection beam** visualization from dish to connected satellite
- **Day/night globe** with city lights on the dark side and atmospheric glow

## Quick start

```bash
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000). If no Starlink dish is detected on the network, **demo mode** activates automatically with simulated telemetry.

## Connecting to a Starlink dish

The server connects to a Starlink dish via gRPC at `192.168.100.1:9200` (the standard Starlink router address). You must be on the Starlink network.

```bash
# Custom dish address
DISH_ADDRESS=192.168.100.1:9200 npm run dev

# Force demo mode (no dish required)
DEMO_MODE=true npm run dev

# Custom dish location (defaults to 48.910°N, 1.910°E)
NEXT_PUBLIC_DISH_LAT=37.7749 NEXT_PUBLIC_DISH_LON=-122.4194 npm run dev
```

## Architecture

```
server.ts                    Custom HTTP + WebSocket + Next.js server
├── gRPC client              Polls dish status (1s) and history (5s)
├── WebSocket server         Broadcasts telemetry to all browser clients
└── Next.js app              Serves the frontend

src/
├── components/
│   ├── scene/               3D scene (React Three Fiber)
│   │   ├── Globe            Earth with day/night textures
│   │   ├── Satellites       Instanced mesh, SGP4-propagated
│   │   ├── GpsSatellites    GPS constellation overlay
│   │   ├── Sun              Directional light + glow + lens flare
│   │   ├── Moon             Textured sphere with Fresnel halo
│   │   ├── Atmosphere       Fresnel glow shader
│   │   ├── GroundStations   Gateway markers (star-shaped, operational/planned)
│   │   ├── ConnectionBeam   Dish-to-satellite-to-gateway beams
│   │   ├── DishMarker       Your dish location
│   │   └── SceneSetup       Camera, controls, starfield
│   └── hud/                 Overlay panels
│       ├── StatusBar        Connection state, uptime, quality
│       ├── TelemetryPanel   Ping, throughput, SNR charts
│       ├── SatelliteInfoPanel  Satellite link, gateway, PoP, confidence
│       ├── HandoffPanel     Starlink Network stats, shell info, handoffs
│       ├── EventLog         Real-time event feed
│       └── ViewControls     Auto-rotate, altitude filter
├── stores/                  Zustand state (app + telemetry)
├── hooks/                   useSatellites, useHandoff
└── lib/
    ├── grpc/                Dish protocol, mock data
    ├── satellites/          TLE fetching, SGP4 propagation, satellite store
    ├── websocket/           Client + server + protocol
    └── utils/               Coordinates, astronomy, formatting
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (HTTP + WebSocket + Next.js) |
| `npm run dev:next` | Start Next.js only (no backend polling) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run tests (vitest) |
| `npm run update-gs` | Update ground station data |

## Tech stack

- **[Next.js 16](https://nextjs.org/)** — App router, API routes, SSR
- **[React Three Fiber](https://r3f.docs.pmnd.rs/)** — React renderer for Three.js
- **[drei](https://drei.docs.pmnd.rs/)** — R3F helpers (OrbitControls, Stars, textures)
- **[satellite.js](https://github.com/shashwatak/satellite-js)** — SGP4/SDP4 orbital propagation
- **[Zustand](https://zustand.docs.pmnd.rs/)** — Lightweight state management
- **[gRPC](https://grpc.io/)** — Dish communication protocol
- **[Tailwind CSS 4](https://tailwindcss.com/)** — Styling

## How it works

**Satellite propagation**: TLE (Two-Line Element) data is fetched from CelesTrak. Each satellite's position is computed every animation frame using the SGP4 algorithm, written into a `Float32Array`, and rendered as an instanced mesh — allowing thousands of satellites with a single draw call.

**Dish telemetry**: The Node.js server connects to the Starlink dish's gRPC interface, polling status and signal history. Data is broadcast over WebSocket to all connected browsers and stored in Zustand.

**Sun and Moon**: Positions are computed from real astronomical algorithms — the Sun from ecliptic longitude and Earth's axial tilt, the Moon from mean orbital elements with perturbation corrections. The directional light follows the Sun, so the globe's day/night side and the Moon's phase are both physically accurate.

## Data sources and accuracy

This project aims to be as accurate as possible using exclusively public data. No proprietary SpaceX systems, internal APIs, or classified constellation parameters were used.

| Source | What it provides |
|--------|-----------------|
| [CelesTrak / NORAD](https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle) | TLE orbital parameters for every tracked Starlink & GPS satellite |
| [Starlink dish gRPC API](https://github.com/sparky8512/starlink-grpc-tools) | Real-time telemetry from your own dish (signal, throughput, antenna orientation) |
| [FCC / ITU filings](https://fcc.report) | Ground station locations, cross-referenced with community research |
| Starlink DNS conventions | PoP code mappings (e.g., `customer.frntdeu.pop.starlinkisp.net` → Frankfurt) |
| System traceroute / DNS | Network path analysis — which internet exit point your traffic uses |

**What this app does NOT have access to**: SpaceX's internal satellite scheduling, inter-satellite laser link routing, per-satellite capacity/load, precise orbital data used by the dish (more accurate than public TLEs), or satellite maneuver/deorbit status.

Everything beyond public data and live dish readings is an approximation or educated guess. For a full breakdown of what's measured vs. inferred, see the [Technical Review](docs/TECHNICAL_REVIEW.md).

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** — Setup, configuration, UI walkthrough, and feature reference
- **[Technical Review](docs/TECHNICAL_REVIEW.md)** — Data sources, accuracy analysis, and what's measured vs. approximated

## License

MIT
