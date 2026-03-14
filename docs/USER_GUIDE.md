# Starlink Mission Control — User Guide

A real-time 3D dashboard for monitoring your Starlink dish, visualizing the full satellite constellation, and tracking network performance.

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app auto-detects whether a Starlink dish is reachable — if yes, it runs in **Live** mode; otherwise, it falls back to **Demo** mode with simulated telemetry.

---

## Configuration

All configuration is via environment variables. Create a `.env.local` file in the project root:

```env
# Mode: auto (default), true (force demo), false (force live)
DEMO_MODE=auto

# Dish gRPC address (default: 192.168.100.1:9200)
DISH_ADDRESS=192.168.100.1:9200

# Dish location (latitude/longitude in degrees)
NEXT_PUBLIC_DISH_LAT=48.910
NEXT_PUBLIC_DISH_LON=1.910

# Server port (default: 3000)
PORT=3000

# Polling intervals (milliseconds)
STATUS_POLL_MS=1000       # Dish status polling
HISTORY_POLL_MS=5000      # Telemetry history
POP_POLL_MS=10000         # Point of Presence detection
TRACEROUTE_POLL_MS=60000  # Network path analysis

# Data freshness
TLE_CACHE_HOURS=6         # How long to cache satellite TLE data
TELEMETRY_LOG_EVERY=5     # Log to event log every Nth status poll
```

### Dish Location

Set `NEXT_PUBLIC_DISH_LAT` and `NEXT_PUBLIC_DISH_LON` to your dish's coordinates. This controls:
- Where the dish marker appears on the globe
- Which satellites are within your antenna's steering cone
- Azimuth/elevation calculations for satellite tracking

### Demo vs Live Mode

| `DEMO_MODE` | Behavior |
|---|---|
| `auto` (default) | Tries to connect to dish at startup. Falls back to demo if unreachable. |
| `true` | Always uses simulated telemetry. No dish needed. |
| `false` | Always tries live connection. Errors if dish unreachable. |

You can also toggle modes at runtime using the **Demo/Live** switch in the top-right controls panel.

---

## Interface Overview

### 3D Globe

The main view shows Earth with the full Starlink constellation (~7,500 tracked satellites) rendered in real-time using SGP4 orbital propagation from NORAD TLE data.

**Mouse controls:**
- **Drag** — Orbit the camera around the globe
- **Scroll** — Zoom in/out (range: 1.5x to 5x Earth radius)
- **Double-click** — Snap camera to a point on the globe

**Visual elements on the globe:**
- **Satellites** — Color-coded by orbital shell (ascending inclination):
  - Gold — 33° inclination (low-latitude, FCC-authorized but not yet launched)
  - Orange — 43° inclination (mid-latitude, actively deploying)
  - Blue — 53° inclination (main coverage shell)
  - Teal — 70° inclination (high-latitude coverage)
  - Pink-red — 97.6° inclination (polar shell)
  - Magenta — Satellites within your antenna's steering cone
  - Bright pink — Currently connected satellite
- **Cyan beam** — Uplink path from your dish to the connected satellite
- **Orange beam** — Downlink path from satellite to nearest gateway
- **Animated particles** — Data flow along both beams
- **Cyan marker** — Your dish location (pulsing glow)
- **Orange stars** — Operational gateway ground stations (204 total, sourced from FCC/international filings)
- **Dim orange stars** — Planned/under construction gateways (excluded from routing)
- **Green markers** — GPS satellites (MEO orbit, much higher altitude)
- **Amber line** — Day/night terminator boundary

### HUD Panels

#### Top-Left: Status & Telemetry

**System Status** — Connection state, uptime, signal quality, firmware version, GPS satellite count.

**Telemetry** (hidden on mobile) — Four sparkline charts showing real-time ping, download speed, upload speed, and signal-to-noise ratio.

**Satellite Link** — Currently connected satellite name, NORAD ID, azimuth, elevation, altitude, orbital velocity, gateway, PoP location. In live mode, shows a **confidence indicator** (green/yellow/red) comparing measured ping to geometric latency — a large delta suggests the satellite guess may be wrong or traffic is ISL-routed.

**Starlink Network** — Connection health (DEMO/LIVE mode, TLE data age, WebSocket status), per-shell satellite counts (operational/total/percentage for each of the 5 orbital shells), gateway counts (operational + planned), and handoff tracking (count, last handoff time, unique satellites seen).

#### Top-Right: Controls

- **Demo/Live toggle** — Switch between simulated and real dish data
- **Auto-Rotate** — Toggle continuous globe rotation
- **Focus Dish** — Center the camera on your dish location

#### Bottom-Center: Event Log

Scrollable log of system events with latency context:
- **Satellite handoffs** — which satellite replaced which, with azimuth, elevation, and latency delta (e.g., "Handoff: STARLINK-1234 → STARLINK-5678 (az 42°, el 55°, -3ms)")
- **Gateway switches** — previous and new gateway with latency delta (e.g., "Gateway switch: Bordeaux → Frankfurt (+8ms)")
- PoP transitions
- Obstruction alerts
- Network status changes

---

## Live Mode

When connected to a real Starlink dish, the app reads telemetry via the dish's local gRPC API (`192.168.100.1:9200`). This provides:

- Real ping latency, throughput, and SNR from the dish
- Antenna boresight orientation
- Obstruction percentage
- Device state, hardware/software version
- Alert conditions

Additionally, the server runs periodic **traceroutes** to identify your network path through the Starlink backbone and detect your exit PoP (Point of Presence).

**Requirements for live mode:**
- Computer must be on the Starlink network (connected to dish's router)
- Dish must be accessible at `192.168.100.1` (default Starlink network config)
- No firewall blocking port 9200

### Demo Mode

When no dish is available, telemetry is simulated with realistic values. Satellite positions, handoffs, and gateway selection still use real orbital data — only the dish telemetry (ping, throughput, SNR) is synthetic.

In demo mode, ping latency is computed from actual satellite geometry (distance from dish to satellite to gateway, at speed of light) rather than arbitrary values.

---

## Data Sources

| Data | Source | Update Frequency |
|---|---|---|
| Satellite positions | CelesTrak NORAD TLEs + SGP4 propagation | Every 6 hours (TLE fetch), 60 FPS (propagation) |
| GPS satellites | CelesTrak GPS TLEs | Every 6 hours |
| Ground stations | FCC/regulatory filings | Static (update via `npm run update-gs`) |
| Dish telemetry | gRPC API (live) or simulation (demo) | Every 1 second |
| Network path | System traceroute | Every 60 seconds (live only) |
| PoP location | Reverse DNS lookup | Every 10 seconds (live only) |

---

## Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Production build
npm run start        # Production server
npm run test         # Run test suite
npm run update-gs    # Refresh ground station database from public sources
```

---

## Troubleshooting

**"ACQUIRING SIGNAL..." stays on screen**
TLE data is loading from CelesTrak. Check your internet connection. If CelesTrak is unreachable, cached data will be used if available.

**No satellite connection beam showing**
The dish location may not have any satellites in the steering cone at this moment. Wait — satellite passes are typically 15-90 seconds apart. Check that `NEXT_PUBLIC_DISH_LAT` and `NEXT_PUBLIC_DISH_LON` are set correctly.

**Live mode shows "DEMO" after toggling**
The dish may not be reachable. Verify you're on the Starlink network and `192.168.100.1:9200` is accessible.

**TLE status shows "stale" in red**
TLE data hasn't been refreshed in over 24 hours. Check internet connectivity. The app will continue working with stale TLEs but satellite positions may drift ~1-2 km per day.

**WebSocket indicator is red**
The real-time data connection to the server dropped. The app will auto-reconnect with exponential backoff (1s, 2s, 4s... up to 10s).
