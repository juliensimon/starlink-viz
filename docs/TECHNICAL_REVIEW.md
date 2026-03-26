# Starlink Mission Control Dashboard — Technical Review

---

## Data Sources & Disclaimer

**This application relies exclusively on publicly available data and live dish telemetry.** No proprietary SpaceX systems, internal APIs, or classified constellation parameters were used.

### What the app actually has access to


| Source                       | Type          | What it provides                                                                               | Reference                                                                                         |
| ---------------------------- | ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **HF TLE Dataset / NORAD**   | Public        | Two-Line Element sets (TLEs) — orbital parameters for every tracked Starlink & GPS satellite   | [juliensimon/starlink-tle-latest](https://huggingface.co/datasets/juliensimon/starlink-tle-latest) (CelesTrak fallback) |
| **Starlink dish gRPC API**   | Local device  | Real-time telemetry from your own dish (signal quality, throughput, ping, antenna orientation) | [starlink-grpc-tools (GitHub)](https://github.com/sparky8512/starlink-grpc-tools)                 |
| **System traceroute / DNS**  | Local network | Network path analysis — which internet exit point your traffic uses                            | Standard network utilities                                                                        |
| **FCC / ITU filings**        | Public        | Ground station locations (cross-referenced with community research)                            | [FCC IBFS via fcc.report](https://fcc.report); [ARCEP](https://www.arcep.fr); [Ofcom](https://www.ofcom.org.uk) |
| **Starlink DNS conventions** | Observed      | PoP code mappings (e.g., `customer.frntdeu.pop.starlinkisp.net` → Frankfurt)                   | Community-documented patterns                                                                     |
| **starlink.sx**              | Community     | Gateway locations with coordinates, antenna counts, Ka/E-band status                           | [starlink.sx/gateways.json](https://starlink.sx/gateways.json)                                   |
| **Starlink Insider**         | Community     | Curated gateway list with operational status                                                    | [starlinkinsider.com](https://starlinkinsider.com/starlink-gateway-locations/)                    |
| **starlink-geoip-data**      | Community     | PoP city list derived from Starlink rDNS records                                               | [GitHub: clarkzjw/starlink-geoip-data](https://github.com/clarkzjw/starlink-geoip-data)          |


### What the app does NOT have access to

- SpaceX's internal scheduling system that decides which satellite serves which user
- How satellites route traffic to each other via laser links
- How much capacity each satellite has, or how loaded it is
- The precise orbital data the dish actually uses (more accurate than what's public)
- Weather conditions at gateway ground stations
- Which satellites are maneuvering, raising orbit, or being deorbited
- Satellite firmware versions (which determine available features like ISL routing and beam capabilities)
- Whether a satellite at operational altitude is actually healthy and serving traffic vs. failed in place

**Everything in this app that goes beyond public data and live dish readings is an assumption, approximation, or educated guess.** The sections below make explicit which is which.

---

## How Starlink Actually Works

### The 30-Second Version

Your flat-panel antenna ("Dishy") electronically steers a radio beam to track a Starlink satellite ~550 km overhead — about the altitude of the International Space Station, but moving at 7.5 km/s (27,000 km/h). The satellite receives your signal, converts it to a different frequency, and beams it down to a ground station that connects to the internet. Every few minutes, the satellite you're using moves out of range and the dish seamlessly switches to the next one — you never notice.

### The Full Signal Path

```
Your Dish ("Dishy")
  ↕  Ku-band radio (10.7-14.5 GHz — similar to satellite TV frequencies)
Starlink Satellite (~550 km up, moving at 7.5 km/s)
  ↕  Ka-band radio (17.8-29.1 GHz — higher frequency, more bandwidth)
Gateway Ground Station (SpaceX facility with large dish antennas)
  ↕  Fiber optic cable
Internet PoP (Point of Presence — where Starlink meets the public internet)
  ↕  Standard internet routing
Public Internet
```

Key details:

- The dish uses a **phased-array antenna** — it steers its beam electronically with no moving parts (Gen 2+). Think of it like noise-canceling headphones, but for radio waves: by precisely timing thousands of tiny antenna elements, it can point its beam in any direction within its steering range. A small motor tilts the whole panel during initial setup.
- Satellites orbit in **multiple shells** at different inclinations and altitudes (570–900 km observed). The primary shells include 53° (covering most populated areas), 70°, and 97.6° (polar orbits for global coverage), with the 43° shell actively being filled. A 33° shell is FCC-authorized but not yet launched (as of March 2026). Each shell uses dozens of orbital planes with ~22 satellites per plane. The app visualizes five shells by inclination color: 53° (blue), 43° (orange), 33° (gold), 70° (teal), and 97.6° (pink-red).
  - **Source:** [SpaceX FCC filings](https://fcc.report/IBFS/SAT-MOD-20200417-00037); [Jonathan McDowell's tracking](https://planet4589.org/space/con/star/stats.html)
- **Handoffs** happen every 15–90 seconds (community-observed range). The dish pre-computes the next satellite and establishes a link to it *before* dropping the current one (make-before-break), so you don't notice the switch.
  - **Source:** Community observation via [r/Starlink](https://reddit.com/r/Starlink) and [Oleg Kutkov's research](https://olegkutkov.me/)
- **Inter-satellite laser links (ISLs)** on newer satellites (v1.5+ and v2 Mini) let traffic hop between satellites in space without needing a ground station in range. This is critical over oceans and near the poles. Each laser-equipped satellite has **four laser terminals** connecting to neighbors.
  - **Source:** [SpaceX FCC filings](https://fcc.report/IBFS/SAT-MOD-20200417-00037); [Aaron Bateman, MIT Technology Review](https://www.technologyreview.com/)

---

## What This App Gets Right (Grounded in Real Data)

### 1. Orbital Propagation — Verified ✓

**Data source:** Real NORAD TLEs from HF dataset [`juliensimon/starlink-tle-latest`](https://huggingface.co/datasets/juliensimon/starlink-tle-latest) (CelesTrak fallback), propagated with SGP4 via [`satellite.js`](https://github.com/shashwatak/satellite-js).

**Implementation:** `src/lib/satellites/propagator.ts` — uses `satellite.js` to run SGP4, writes positions into a shared `Float32Array` for instanced rendering. Propagation is batched (1/6 of the constellation per frame) for performance.

The app uses **SGP4** — the same math model that NORAD, NASA, and every satellite tracker in the world uses to predict where satellites are. This isn't a simplification; it's the actual standard.

**What SGP4 accounts for:**

- Earth isn't a perfect sphere — it's wider at the equator, which tugs satellites' orbits over time (the "J2" effect, and the dominant force at LEO)
- Atmospheric drag gradually slows satellites down (using a drag coefficient baked into each TLE)
- Gravitational pull from the Sun and Moon
- Solar radiation pressure (sunlight pushing on the satellite)

**How accurate is it?** TLEs are typically good to ~1 km at the time they're published, drifting ~1-2 km per day after that. For showing which satellite is overhead on a globe, this is more than enough — you'd need a magnifying glass to see the difference.

**What the real dish uses instead:** SpaceX uplinks precise orbital data directly to each dish — far more accurate than public TLEs. But at the scale of a globe visualization, the difference is invisible.

**References:**
- Vallado, D. et al. "Revisiting Spacetrack Report #3" (2006) — the canonical SGP4 reference
- [CelesTrak FAQ on TLE accuracy](https://celestrak.org/columns/v04n09/)

### 2. Coordinate Transforms — Verified ✓

**Data source:** WGS-84 standard — the same coordinate system used by GPS.

**Implementation:** `src/lib/utils/coordinates.ts` — converts geodetic (lat/lon/alt) to the app's Cartesian system. `src/lib/utils/dish-frame.ts` — builds the local East-North-Up frame for azimuth/elevation computation.

The app converts between three coordinate systems:

1. **ECI** (Earth-Centered Inertial) — where SGP4 gives satellite positions, with axes fixed to the stars
2. **Geodetic** (lat/lon/altitude) — the familiar coordinates on a map
3. **Cartesian** (x/y/z on the 3D globe) — what the renderer needs, using: X = cos(lat)cos(lon), Y = sin(lat), Z = -cos(lat)sin(lon)

These transforms use the WGS-84 ellipsoid constants (Earth's equatorial radius: 6,378.137 km; polar flattening: 1/298.257). This is textbook geodesy — the same math your phone's GPS uses. No assumptions.

**Reference:** [NGA WGS-84 specification](https://earth-info.nga.mil/php/download.php?file=coord-wgs84)

### 3. Local Horizon Frame (Az/El) — Verified ✓

**Data source:** Standard spherical trigonometry.

**Implementation:** `src/lib/utils/dish-frame.ts` — `computeAzEl()` builds a local East-North-Up reference frame at the dish location and projects satellite directions onto it.

To figure out where a satellite appears in *your* sky, the app builds a local reference frame at the dish location: East, North, and Up. It then projects the satellite's direction onto these axes to get **azimuth** (compass direction, 0° = north, 90° = east) and **elevation** (angle above the horizon).

This is the exact same math that antenna controllers at ground stations worldwide use to point dish antennas. No approximation.

### 4. Antenna Steering Cone — Approximation ⚠️

**Data source:** Community observation and FCC filings. The real value is proprietary.

**Implementation:** `src/lib/config.ts` — `MAX_STEERING_DEG = 25`, `MIN_ELEVATION_DEG = 25`. Used in `src/components/scene/ConnectionBeam.tsx` to filter candidate satellites.

The app assumes the dish can electronically steer its beam within a **25° cone** from its boresight (the direction the flat panel faces), and ignores satellites below **25° elevation**.

**Why this is approximate:**

- SpaceX doesn't publish the actual steering range — it varies by hardware revision (round Gen 1 vs. rectangular Gen 2 vs. Gen 3)
- 25° comes from community observation and FCC filing diagrams; Gen 3 hardware likely has different capabilities
- The real antenna pattern isn't a perfect cone — it's an irregular shape determined by the array geometry, with signal quality that degrades non-uniformly depending on which direction the beam is steered (scan loss)
- The minimum elevation cutoff (25° above the horizon) is similarly a community estimate; the real cutoff probably varies with conditions and hardware revision

**References:**
- [SpaceX FCC application for user terminal](https://fcc.report/IBFS/SES-LIC-INTR2020-02547) — antenna pattern diagrams
- [r/Starlink community measurements](https://reddit.com/r/Starlink)
- [Oleg Kutkov's phased array analysis](https://olegkutkov.me/)

### 5. TLE Data Source — Verified ✓

**Data source:** HF dataset [`juliensimon/starlink-tle-latest`](https://huggingface.co/datasets/juliensimon/starlink-tle-latest) — raw TLE files sourced daily from [CelesTrak](https://celestrak.org) (Dr. T.S. Kelso) via an automated pipeline in [juliensimon/space-datasets](https://github.com/juliensimon/space-datasets). CelesTrak is retained as a fallback if the HF dataset is unreachable.

**Implementation:** `src/lib/satellites/tle-fetcher.ts` — fetches raw TLE text from the HF dataset (falling back to CelesTrak), parsed by `src/app/api/tle/route.ts`. GPS TLEs use the same dataset's `gps.tle` file via `src/app/api/tle-gps/route.ts`. The client-side hook (`src/hooks/useSatellites.ts`) retries with exponential backoff (1s, 2s, 4s). Both routes cache in-memory for 6 hours.

The app fetches ~10,000 Starlink satellite TLEs. The HF dataset is updated daily at 05:00 UTC from CelesTrak, which itself updates roughly twice daily from NORAD. The app tracks when TLEs were last fetched and displays TLE age in the status bar.

**Gap:** TLEs don't tell you whether a satellite is operational, still raising its orbit to the right altitude, maneuvering, or being deorbited. The app uses **per-shell altitude bands** (defined in `src/lib/config.ts`) to estimate operational status based on whether a satellite is near its shell's target altitude.

**Gen1 (Phase 1) — ~4,408 satellites across 5 shells:**

| Shell | Filed Altitude | Inclination | Satellites | Status |
|-------|---------------|-------------|------------|--------|
| 1 | 550 km | 53.0° | 1,584 | Complete |
| 2 | 540 km | 53.2° | 1,584 | Complete |
| 3 | 570 km | 70.0° | 720 | Complete |
| 4 | 560 km | 97.6° | 348 | Complete |
| 5 | 560 km | 97.6° | 172 | Complete |

**Gen2 (FCC 22-91, Dec 2022) — 7,500 satellites authorized across 3 shells:**

| Shell | Filed Altitude | Inclination | Status |
|-------|---------------|-------------|--------|
| Gen2-A | 525 km | 53° | Actively deploying |
| Gen2-B | 530 km | 43° | Actively deploying |
| Gen2-C | 535 km | 33° | Not yet launched |

**Gen2 Upgrade (FCC DA 26-36, Jan 2026) — additional 7,500 satellites authorized** at VLEO altitudes (340–485 km) with inclinations of 28°/32°, 43°, and 53°. Not yet populated. These shells are where Starship-launched full-size V2 satellites will eventually operate.

The app's per-shell operational altitude bands are derived from **SGP4-propagated instantaneous altitudes** (March 2026), not mean-motion averages or FCC-filed altitudes — both of which can differ by 100+ km from the actual position due to orbital drag modeling.

| Shell | FCC-filed | SGP4-observed clusters | Operational band |
|-------|-----------|----------------------|-----------------|
| 33° | 535 km | Not yet launched | 460–570 km (placeholder) |
| 43° | 530 km | 460–570 km | 460–570 km |
| 53° | 525–550 km | 480–490 km (lowered Gen1) + 540–560 km (original) | 460–570 km |
| 70° | 570 km | ~880–900 km | 460–910 km |
| 97.6° | 560 km | 550–590 km | 460–600 km |

Discrepancies between filed and observed altitudes are substantial. The 70° shell operates ~330 km higher than its FCC filing. The 53° shell has two distinct clusters: Gen1 satellites intentionally lowered to ~480 km (announced January 2026) and those still at original 540–560 km altitude. Satellites at ~280 km in any shell are orbit-raising (just launched) and correctly excluded.

This is a heuristic with known limitations:

- **False positives:** Failed satellites at operational altitude stay there for months before drag brings them down — the altitude filter counts them as "operational" even though they're not serving traffic.
- **Orbit-raising satellites:** Newly launched satellites at ~280 km are correctly excluded, but satellites mid-climb (e.g., 400–460 km) are also excluded even if they may already be serving traffic during ascent.
- **Non-commercial objects:** The CelesTrak "Starlink" TLE group (used as the upstream source for the HF dataset) may include Starshield (military/government) objects that NORAD catalogs alongside commercial Starlink satellites. These operate under different parameters and may be at non-standard altitudes, particularly in the 97.6° polar shell.
- **Filed vs observed drift:** The observed altitudes may shift over time as SpaceX adjusts the constellation. The bands should be periodically validated against current TLE data.
- **Future VLEO conflict:** When SpaceX populates the authorized VLEO shells (340–365 km), the 460 km lower bound will become ambiguous — a satellite at 360 km could be orbit-raising to 570 km or operating in a VLEO shell. This will require new discrimination logic (likely by launch date or NORAD ID range).

**References:**
- [FCC 22-91 — Gen2 Authorization (Dec 2022)](https://docs.fcc.gov/public/attachments/FCC-22-91A1.pdf)
- [FCC DA 26-36 — Gen2 Upgrade Authorization (Jan 2026)](https://docs.fcc.gov/public/attachments/DA-26-36A1.pdf)
- [Jonathan McDowell — Starlink Statistics](https://planet4589.org/space/con/star/stats.html)

### 6. Ground Station & PoP Locations — Partially Verified ⚠️

**Data source:** Multi-source: community databases, regulatory filings, and Starlink rDNS records. Runtime data loaded exclusively from HuggingFace dataset.

**Implementation:** Ground stations are loaded exclusively from the HF dataset [`juliensimon/starlink-ground-stations`](https://huggingface.co/datasets/juliensimon/starlink-ground-stations) (gateways and pops configs). The `GROUND_STATIONS` array starts empty and is populated via `refreshGroundStations()`: server-side fetches directly from the HF API, client-side fetches from `/api/ground-stations`. All derived data (3D positions, backhaul RTT, ISL pathfinder arrays) uses lazy recomputation via a `groundStationsVersion` counter. Stations have `type` (`'gateway'` | `'pop'`) and `status` (`'operational'` | `'planned'`) fields. Planned stations are rendered with reduced opacity. Both planned and PoP entries are excluded from gateway selection routing in `isl-pathfinder.ts`.

A **daily automated pipeline** (`juliensimon/space-datasets` on GitHub) scrapes Starlink Insider and FCC IBFS data, geocodes locations, and pushes updated parquet files to the HF dataset. The local `data/ground-stations.json` file serves as an offline backup but is not used at runtime.

**Why "partially verified":**

- SpaceX doesn't publish an official station list
- Some sites may be planned but not yet built; some operational sites may still be missing
- The app has no idea whether a gateway is currently online, overloaded, or down for maintenance; it treats all operational stations as equally available
- PoP classification relies on Starlink rDNS naming conventions which may change

**Data sources for ground stations:**
- **[starlink.sx](https://starlink.sx/gateways.json)** — primary structured source with coordinates, antenna counts, Ka/E-band operational status per gateway (~350 entries). Credit: starlink.sx community
- **[Starlink Insider](https://starlinkinsider.com/starlink-gateway-locations/)** — curated gateway list with operational/construction status. Credit: Starlink Insider community
- **[starlink-geoip-data](https://github.com/clarkzjw/starlink-geoip-data)** — PoP city list (52 cities) derived from Starlink rDNS records (`customer.<pop-id>.pop.starlinkisp.net`)
- **US gateways:** [FCC IBFS (International Bureau Filing System)](https://fcc.report) — SpaceX is required to file Earth Station applications for every US gateway
- **International gateways:** Filed with each country's telecom regulator — [ARCEP](https://www.arcep.fr) (France), [Ofcom](https://www.ofcom.org.uk) (UK), [ACMA](https://www.acma.gov.au) (Australia), among others
- **US filing count:** [Data Center Dynamics reporting on SpaceX FCC applications](https://www.datacenterdynamics.com)

### 7. PoP Identification — Verified ✓ (Live Mode Only)

**Data source:** Traceroute and DNS lookups from your actual network connection.

**Implementation:** `src/lib/utils/pop.ts` — regex extraction of city codes from Starlink DNS hostnames. `src/lib/utils/traceroute.ts` — executes system traceroute. The server polls every 10s (`POP_POLL_MS`) with rotating targets (1.1.1.1, 8.8.8.8, 9.9.9.9).

When connected to a real Starlink dish, the app traces the network path your traffic takes and identifies your internet exit point (PoP) by parsing Starlink's DNS naming convention: `customer.frntdeu.pop.starlinkisp.net` → Frankfurt, Germany.

This is the same technique network engineers use. It only works in live mode — demo mode has no real network path to analyze.

### 8. gRPC Hardware Telemetry — Verified ✓ (Live Mode Only)

**Data source:** Your dish's local API at `192.168.100.1:9200` (configurable via `DISH_ADDRESS` env var).

**Implementation:** `src/lib/grpc/client.ts` — uses `@grpc/proto-loader` to dynamically load the protobuf definition. Polling intervals: status every 1s, history every 5s. Types defined in `src/lib/grpc/types.ts`.

Every Starlink dish runs a gRPC server that the official Starlink app uses for diagnostics. This app taps into the same interface to read:

| Telemetry field          | What it measures                                     |
| ------------------------ | ---------------------------------------------------- |
| `popPingLatency`         | Round-trip ping to the PoP (ms)                      |
| `downlinkThroughput`     | Current download speed (bytes/s)                     |
| `uplinkThroughput`       | Current upload speed (bytes/s)                       |
| `snr`                    | Signal-to-noise ratio (dB)                           |
| `boresightAzimuth/El`   | Physical antenna orientation (degrees)               |
| `obstructionPercentTime` | Sky obstruction (0–100%)                             |
| `uptime`                 | Time since last reboot (seconds)                     |
| `state`                  | Connection state (CONNECTED/SEARCHING/BOOTING)       |
| `gpsSats`                | GPS satellites in view                               |
| `popPingDropRate`        | Packet loss (0–1)                                    |
| `deviceId`, `hwVersion`, `swVersion` | Hardware identification               |

**Caveats:**

- This API is **undocumented and unsupported** — SpaceX could change or remove it in any firmware update
- The reported boresight angle is where the *panel is physically pointing*, not where the *beam is electronically steered to*. Think of it like knowing which direction a flashlight is held, but not where the beam is actually shining after bouncing off a mirror. The phased array is that "mirror."
- The API doesn't tell you *which satellite* you're connected to. The app has to guess (see below)

**References:**
- [starlink-grpc-tools](https://github.com/sparky8512/starlink-grpc-tools) — community reverse-engineering of the dish gRPC API
- [Starlink protocol buffers](https://github.com/sparky8512/starlink-grpc-tools/tree/main/dish_grpc_text.py) — community-maintained proto definitions

### 9. Satellite Count — Verified ✓

The app renders ~10,000 satellites (instanced mesh in `src/components/scene/Satellites.tsx`), matching the current public NORAD catalog. The actual number of *operational* satellites is slightly lower — the catalog includes objects still raising orbit or being deorbited.

**Reference:** [Jonathan McDowell's Starlink statistics](https://planet4589.org/space/con/star/stats.html) — the most comprehensive independent tracking of Starlink launches and operational status.

---

## Assumptions, Approximations & Gaps

This section documents every place where the app goes beyond what public data and live dish telemetry can tell us. **If you see it on screen and it's not listed above as "Verified," it's in this section.**

### 1. "Which satellite am I connected to?" — Best Guess

**The fundamental limitation:** The dish's API doesn't tell you which satellite you're talking to. No NORAD ID, no name, nothing. The app has to figure it out.

**How it guesses (in `ConnectionBeam.tsx:findBestSatellite()`):**

1. Gets the dish's physical antenna orientation (`antennaBoresightAz`, `antennaBoresightEl`) from gRPC telemetry
2. Converts this to a 3D direction vector using `azElToDirection()`
3. Iterates all satellites, filtering to those within the global operational altitude band (525–920 km) and above 25° elevation
4. Checks if each candidate is within the 25° steering cone (dot product with boresight direction > cos(25°))
5. Ranks by dot product (best alignment wins); when two satellites score within ~0.01 of each other, breaks ties by **total path length** (`totalPathLength()` = dish-to-sat + sat-to-nearest-GS distance), preferring the shorter path as a latency proxy
6. **Hysteresis:** if the current satellite is still in the cone and above minimum elevation, it sticks — the app won't switch unless the current satellite leaves the valid region

Selection runs every **500ms** (not every frame, for performance).

**Why this might be wrong:**

- SpaceX's scheduling system may assign a satellite that's not the "best" from a geometry standpoint — maybe it has more capacity, or the "better" satellite is already overloaded
- The phased array steers the beam electronically relative to the panel, so the antenna orientation doesn't exactly match where the beam is pointing
- The 25° cone is an approximation; the real gain pattern is non-uniform

**Bottom line:** The cyan beam on the globe *probably* points at the right satellite most of the time, but there's no way to verify this.

### 2. Satellite Selection Algorithm — Extrapolated

**What the app does:** See §1 above for exact algorithm.

**What the real system considers that we can't:**

- Load balancing — is this satellite already serving too many users?
- Interference — would connecting to this satellite degrade service for nearby users?
- Service tier — priority customers may get different satellite assignments
- Coordination — thousands of terminals are being scheduled simultaneously across multiple beams per satellite
- Satellite health — is this satellite maneuvering or about to deorbit?

**How good is this approximation?** Boresight alignment is a sensible first-order heuristic — the phased array's signal quality peaks in the direction it's pointing, so the satellite closest to that direction likely has the best link. The path-length tiebreaker adds a rough latency preference. But this completely ignores the fleet-wide optimization that makes Starlink work at scale. It's like predicting which Uber driver will pick you up by choosing the nearest one — often right, but the real algorithm is far more complex.

### 3. Gateway Selection — PoP-Constrained with ISL Routing

**What the app does (in `src/lib/utils/isl-pathfinder.ts`):** Gateway selection uses a multi-step algorithm constrained by the user's detected PoP (Point of Presence):

1. **PoP constraint:** The detected PoP (via rDNS on public IP) limits gateway candidates to those within 1,500 km of the PoP city — because your traffic must exit the Starlink network at a gateway that connects to your PoP's internet exchange
2. **Line-of-sight check:** Each candidate gateway is tested for direct satellite visibility (elevation above horizon)
3. **Direct route preferred:** If any PoP-constrained gateway has line-of-sight to the connected satellite, the nearest one is selected (bent-pipe path)
4. **ISL fallback:** When no valid gateway is directly visible (e.g., over oceans), the ISL graph is searched for a multi-hop path through neighboring satellites to reach a gateway
5. **Route hold:** Selected routes are held for 30 seconds with periodic LoS validity checks to prevent flickering
6. **Backhaul estimation:** Each gateway's ground-segment RTT is estimated via haversine distance to the nearest IXP at 0.67c (fiber speed) with a 1.4× fiber route factor (`src/lib/utils/backhaul-latency.ts`)

**What the real system considers that we can't:**

- Is this gateway at capacity? Is it raining there? (Rain severely degrades Ka-band signals — "rain fade" can reduce link margin by 10+ dB)
- Is the traffic's internet destination closer to a different gateway's PoP?
- Real routing table optimization across thousands of concurrent users
- Is this gateway scheduled for maintenance?

**How good is this approximation?** The PoP constraint is a meaningful improvement over pure nearest-gateway — it correctly models that traffic must exit near your assigned PoP. The ISL fallback handles the ocean/remote case where bent-pipe is impossible. However, the real system does fleet-wide optimization that balances load, weather, and capacity across all gateways simultaneously.

### 4. Inter-Satellite Laser Links — Predicted Model ⚠️

**Implementation:** The app models ISL routing using a heuristic-based prediction system. While no public data exists about SpaceX's actual ISL routing decisions, the model uses publicly available information to make educated predictions.

**ISL capability detection** (`src/lib/satellites/isl-capability.ts`):
- Polar shells (70°, 97.6°): all satellites assumed ISL-capable (laser links were deployed from the start on polar missions)
- 53° shell: satellites launched from 2022 onward (v1.5+ and v2 Mini)
- 43° shell: satellites launched from 2023 onward
- 33° shell: satellites launched from 2024 onward
- This heuristic is based on SpaceX's public statements and FCC filings about laser link deployment timelines

**ISL neighbor graph** (`src/lib/satellites/isl-graph.ts`):
- CSR (Compressed Sparse Row) encoded graph rebuilt every 30 seconds
- Each ISL-capable satellite connects to **4 neighbors** (matching the 4 physical laser terminals): 2 in-plane (nearest neighbors in the same orbital plane) and 2 cross-plane (nearest neighbors in adjacent planes, matched by RAAN)
- **Polar exclusion** at ±70° latitude — laser links are assumed inactive near the poles where orbital planes converge and relative angular rates become problematic
- RAAN (Right Ascension of Ascending Node) parsed from TLE data to identify orbital planes

**ISL pathfinding** (`src/lib/utils/isl-pathfinder.ts`):
- ISL routes are only explored when no PoP-constrained gateway has direct line-of-sight to the connected satellite (mandatory ISL scenario)
- When ISL is needed, a breadth-first search through the neighbor graph finds a path to a satellite that can see a valid gateway
- Routes are held for 30 seconds with periodic LoS validity checks

**Latency model:**
- Speed-of-light geometry for each hop (dish → sat → ISL hops → gateway)
- 6 ms base processing RTT
- **0.3 ms OEO (optical-electrical-optical) conversion** per ISL hop — each laser terminal receives, processes, and retransmits the signal
- Per-gateway backhaul RTT from haversine distance to nearest IXP at 0.67c with 1.4× fiber route factor

**Demo locations:** 5 remote locations where ISL is mandatory (Iceland Gap, North Atlantic, Mid-Atlantic, Gulf of Mexico, Celtic Sea) — selectable in ViewControls during demo mode. These demonstrate the ISL routing visualization with colored beam segments (cyan uplink, green ISL hops, orange downlink).

**Why this is still approximate:**
- There is zero public data about which laser links are actually active at any moment
- The 4-terminal topology is from FCC filings, but the actual neighbor selection algorithm is proprietary
- Real ISL routing optimizes for latency, capacity, and link budget simultaneously — the app only considers reachability
- The polar exclusion zone (±70°) is an approximation; the actual cutoff depends on satellite-to-satellite geometry
- The app cannot know if a specific satellite's laser terminals are operational or degraded

**References:**
- [Mark Handley, UCL — "Delay is Not an Option" (2018)](https://dl.acm.org/doi/10.1145/3286062.3286075) — foundational paper on LEO constellation ISL routing
- [SpaceX Gen2 FCC filing](https://fcc.report/IBFS/SAT-MOD-20200417-00037) — describes laser link architecture and 4-terminal design

### 5. Demo Mode Telemetry — Fabricated

**Implementation:** `src/lib/grpc/mock-data.ts` — generates smooth mock data using layered sine waves at different frequencies.

**What the app does:** When no dish is connected (auto-detected, or forced via `DEMO_MODE=true`), throughput, SNR, and obstruction data are generated with layered sine waves and occasional random spikes — they *look* like real telemetry but aren't based on physics.

The ranges are based on publicly reported Starlink performance:

- Download: 25-220 Mbps (matches community speed tests on [speedtest.net Starlink index](https://www.speedtest.net/global-index))
- Upload: 5-20 Mbps
- Ping: 25-60 ms typical, spikes to 200 ms (but see §6 — demo ping is actually physics-based)
- SNR: 9-12 dB (rough estimate from community data)
- Boresight: always 0° in demo mode (no antenna orientation data without a real dish)

**What a real signal simulation would need:**

- Free-space path loss (~169 dB at 550 km, 12 GHz — your signal weakens by a factor of 10^16.9 before reaching the satellite)
- Atmospheric absorption (worse at low elevation angles and in rain)
- Antenna gain pattern and scan loss (signal quality degrades as the beam steers away from center)
- Doppler shift (up to ~±260 kHz at Ku-band — the satellite moves fast enough to noticeably shift the radio frequency, like a siren changing pitch as an ambulance passes)
- System noise temperature
- Adaptive modulation and coding (the satellite adjusts how it encodes data based on signal quality)
- Interference from adjacent beams and other satellite operators

The demo numbers are tuned to *feel* right, not to *be* right.

### 6. Latency Model — Computed from Geometry (Demo Mode)

**Implementation:** `src/lib/utils/geometric-latency.ts` — `computeGeometricLatency()`. Called every 1s from `ConnectionBeam.tsx` in both modes.

**What the app does:**

- **Live mode:** Shows the actual `popPingLatency` measured by the dish hardware. The geometric latency is computed in parallel and used for **cross-validation** — the Satellite Link panel shows a confidence indicator (green/yellow/red) based on the delta between measured and predicted ping. A large delta suggests the satellite guess may be wrong or traffic is ISL-routed.
- **Demo mode:** Geometric latency overrides the mock ping with a physics-based value.
- **Event messages:** When the satellite or gateway changes, the event log shows how much latency changed (e.g., "+8ms" or "-3ms") based on the new path length.

**How it's computed:**

| Segment               | Method                                         | Typical value   |
| --------------------- | ---------------------------------------------- | --------------- |
| Dish → Satellite      | Speed-of-light delay from SGP4 position        | ~1.8 ms one-way |
| Satellite → Gateway   | Speed-of-light delay to gateway (direct or via ISL hops) | ~1.8 ms one-way (direct) |
| ISL hops (if any)     | Speed-of-light per hop + 0.3 ms OEO per hop   | ~2-5 ms per hop |
| Processing            | 6 ms base RTT                                  | 6 ms            |
| Gateway backhaul      | Haversine to nearest IXP at 0.67c × 1.4 fiber factor | 0-8 ms |
| **Round-trip total**  | All segments × 2 + processing + backhaul       | **~20-60 ms**   |

For direct (bent-pipe) routes: `RTT = (dist_dish_sat + dist_sat_gw) × 2 / c × 1000 + 6 + backhaul_rtt` ms

For ISL routes: each hop adds speed-of-light inter-satellite distance + 0.3 ms OEO (optical-electrical-optical conversion).

This is real physics — light travels at ~300,000 km/s, the satellite is ~550 km up, so the uplink alone takes about 1.8 ms. The round trip adds up to ~15 ms of pure speed-of-light delay for a direct path, with ISL hops adding proportionally. Gateway backhaul (`src/lib/utils/backhaul-latency.ts`) estimates fiber-segment delay based on great-circle distance to the nearest internet exchange point.

**What this misses:**

- The processing delay (6 ms) is a guess — real delays depend on the satellite's onboard hardware, the gateway's equipment, and internet routing beyond the PoP
- Real ISL routing optimizes for latency/capacity, not just reachability
- At very low elevation angles, the signal travels through more atmosphere and the path is longer — the app computes this correctly from geometry

### 7. Handoff Mechanics — Simplified

**Implementation:** Handoffs are detected in two places:
- **Server-side** (`server.ts`): detects >10° change in boresight az/el between consecutive polls
- **Client-side** (`ConnectionBeam.tsx`): detects when `connectedSatelliteIndex` changes, triggers a 500ms opacity fade-in animation and logs the event with azimuth, elevation, and latency delta
- **Handoff prediction** (`src/hooks/useHandoff.ts`): measures elevation descent rate (rolling 5-sample average) and estimates time to next handoff as `(elevation - MIN_ELEVATION) / descentRate`

**What the app does:** When the current satellite moves out of the antenna's steering cone (drops below 25° elevation or drifts more than 25° from boresight), the app switches to the next best candidate with a 0.5-second fade animation. Events log the new satellite's position and the latency change.

**How real handoffs work differently:**

- Real handoffs are **make-before-break** — the dish locks onto the new satellite *first*, then drops the old one. You never lose connectivity. The app shows the opposite (fade out, switch, fade in) because it looks better as animation.
- Real handoffs are **scheduled by SpaceX's NOC**, not triggered by elevation. The system might hand off early for load balancing, interference avoidance, or because the satellite is about to maneuver. Scheduling operates at the **beam level**, not the satellite level — a single satellite illuminates multiple beams, and your terminal gets assigned to a beam and timeslot.
- Real handoffs take ~20-50 ms — imperceptible. The app's 500 ms animation is slowed down 10x so you can actually see it happen.
- The 15-90 second handoff cadence is from community observation, not a SpaceX specification.

**The visual intuition is correct** — satellites rise, serve traffic, move across the sky, and hand off to the next one. The trigger and timing are simplified.

### 8. Beam Visualization — Artistic License 🎨

**Implementation:** `ConnectionBeam.tsx` — quadratic Bézier curves with control points lifted above the globe surface, plus 60 animated particles streaming along each path.

The glowing Bézier curves with flowing particles are a **visual metaphor**, not a physical representation:

- Radio beams are invisible. You can't see them. (If you could, the sky would be a nightmare.)
- The real beam isn't a line — it's a cone with a 3-5° width that illuminates a ~15-25 km footprint on the ground
- There is no "particle flow" — radio waves travel at the speed of light (300,000 km/s), completing the trip in under 2 ms. The animated particles move about 150,000x slower than the real signal.
- The curved path is for visual clarity (so the beam doesn't clip through the Earth). The real RF path is a straight line — radio waves don't curve. (Atmospheric refraction bends them slightly at very low angles, but not enough to see.)

This is clearly art, not a technical claim.

### 9. Obstruction Modeling — Simplified in Demo Mode

**Live mode:** The obstruction percentage is real — the dish uses onboard machine learning to scan the sky and identify trees, buildings, or other objects that block satellite signals. This is actual hardware data.

**Demo mode:** Obstruction is faked with sine waves. The real dish builds a detailed **polar map of the sky** marking which directions are blocked, and uses it to predict which satellite passes will be interrupted. None of this intelligence exists in demo mode.

---

## Sky View — Observer's Night Sky

The sky view renders the night sky as seen from the dish location, projecting Starlink satellites, reference stars, and constellations onto a virtual hemisphere dome.

### 10. Observer Frame & Az/El Projection — Verified ✓

**Data source:** Standard geodesy and spherical trigonometry.

**Implementation:** `src/lib/utils/observer-frame.ts` — `computeObserverFrame()` constructs an ENU (East-North-Up) frame from the observer's latitude/longitude. `computeAzElFrom()` projects any 3D point into azimuth/elevation. `azElToDirection3D()` performs the inverse transform. Roundtrip accuracy is confirmed by tests.

The sky view reuses the same ENU math as `dish-frame.ts` (used by ConnectionBeam for satellite selection), but parameterized for any lat/lon — critical for demo location support. The frame construction uses cross(Y_up, normal) for the east vector, with a pole degeneracy guard (cross product magnitude < 1e-10) that falls back to the X-axis when the observer is essentially at a geographic pole.

**Accuracy:** Exact — same math used by antenna controllers worldwide. No approximation.

### 11. Star Coordinate Transform (RA/Dec → Az/El) — Verified ✓

**Data source:** Standard equatorial-to-horizontal coordinate transform.

**Implementation:** `src/lib/utils/star-coordinates.ts` — converts J2000 Right Ascension / Declination to local Azimuth / Elevation using Greenwich Mean Sidereal Time from `satellite.gstime()`.

The algorithm: GMST → Local Sidereal Time (LST = GMST + longitude) → Hour Angle (HA = LST - RA) → standard spherical trig for sin(elevation) and atan2(azimuth). This is the textbook transform used by every planetarium program.

**Known limitation:** No J2000 precession correction. By 2026, accumulated precession is ~0.36° (26 years × 50.3″/year) — imperceptible at the rendering scale. Over decades this would start to matter.

### 12. Star Catalog — Verified ✓

**Data source:** Hipparcos / Yale Bright Star Catalog subset.

**Implementation:** `src/data/bright-stars.ts` — ~500 stars down to magnitude 4.0 with J2000 RA/Dec, apparent magnitude, and B-V color index. Includes all major constellation vertices plus fill stars for visual density.

Spot-checked against SIMBAD/Hipparcos: Sirius (RA 101.287°, Dec -16.716°), Polaris (RA 37.954°, Dec 89.264°), Betelgeuse (RA 88.793°, Dec 7.407°) — all match to within 0.01°.

Star visual properties: size mapped from magnitude (`max(1, 4 - mag) * 0.02`), color from B-V index (blue-white for B-V < -0.1, through white, yellow, orange, to red for B-V > 1.0). Updates every 10 seconds — sidereal rotation moves stars at 15°/hour = 0.04°/10s, imperceptible at normal zoom.

### 13. Constellation Data — Verified ✓ (with corrections applied)

**Data source:** IAU constellation definitions.

**Implementation:** `src/data/constellations.ts` — all 88 IAU constellations with stick-figure line segments defined as RA/Dec coordinate pairs, rendered as `THREE.LineSegments`.

Spot-checked Orion (Betelgeuse, Rigel, belt stars — all correct to 0.01°), Ursa Major (Big Dipper — seven-star pattern correctly connected), Scorpius (Antares through tail — correct), Crux (four-star cross — correct).

**Corrections applied after review:** Mirach (β And) RA/Dec was off by ~9°/20° (fixed to 17.433°, 35.621°); Caph (β Cas) RA was off by ~7° (fixed to 2.295°). Andromeda and Cassiopeia stick figures updated accordingly.

### 14. Earth Shadow Model — Approximation ⚠️

**Data source:** Cylindrical shadow geometry.

**Implementation:** `src/lib/utils/sun-shadow.ts` — `isSatelliteSunlit()` tests whether a satellite is in Earth's shadow using a cylindrical approximation: project the satellite position onto the Earth-Sun axis; if on the night side, check if the perpendicular distance to the axis exceeds Earth's radius (1.0 in scene units).

**Why cylindrical, not conical:** At Starlink altitude (~550 km), the penumbra width is approximately 5 km (Sun's angular radius ~0.265° → `550 km × tan(0.265°) ≈ 2.5 km` half-width). The conical umbra/penumbra model would add complexity for a difference invisible at rendering scale. The cylindrical model is standard for LEO satellite visibility prediction.

**Boundary behavior:** The code compares the *squared* perpendicular distance against 1.0 (Earth's radius squared — an optimization that avoids a sqrt). Satellites exactly on the shadow cylinder wall (`perpDistSq = 1.0`) are treated as shadowed (conservative). In reality they'd be in partial penumbral shadow.

**Usage:** SkySatellites applies the shadow model during periodic color updates (every 100ms). Sunlit satellites render at full shell color brightness; shadowed satellites render at 10% brightness. The SkyHud displays sunlit/shadow counts.

### 15. Sun Direction & Sky Gradient — Approximation ⚠️

**Data source:** Simplified ecliptic longitude model.

**Implementation:** `src/lib/utils/astronomy.ts` — `getSunDirection()` computes sun position from day-of-year ecliptic longitude (`2π(dayOfYear - 80)/365`) with axial tilt rotation. `src/components/scene/sky/SkyEnvironment.tsx` — `computeSkyVertexColor()` maps sun elevation to sky colors.

**Accuracy:** The ecliptic longitude model ignores the equation of center (orbital eccentricity), introducing up to ~2° error (~8 minutes of sunrise/sunset time). Additionally, `dayOfYear` is computed as an integer (`Math.floor`), adding up to ~1° of intra-day stale ecliptic longitude (the time-of-day rotation is applied separately). Combined error: up to ~3° in sun position. Acceptable for a satellite visibility indicator.

**Sky gradient phases:**

| Sun elevation | Phase | Sky appearance |
|---------------|-------|----------------|
| > 10° | Full day | Bright blue, brighter near horizon (Rayleigh scattering approximation) |
| 0° to 10° | Low sun | Warm glow near sun azimuth at horizon |
| -6° to 0° | Civil twilight | Deep blue with orange/pink horizon glow |
| -12° to -6° | Nautical twilight | Dark blue, faint glow |
| -18° to -12° | Astronomical twilight | Very dark, barely perceptible |
| < -18° | Night | Near black |

The gradient is azimuth-aware — vertices near the sun's azimuth get warmer colors during sunset/twilight, simulating the directional glow. Breakpoints match `computeSkyVertexColor()` in `SkyEnvironment.tsx`. This is a visual approximation, not a physically-based atmospheric scattering model.

### 16. Satellite Trajectory on Hover — Verified ✓

**Implementation:** `src/components/scene/sky/SkyTrajectory.tsx` — when a satellite is hovered in sky view, propagates its position ±5 minutes using `propagatePosition()` (SGP4) at 80 time steps, projects each position to az/el on the dome.

This uses the same SGP4 propagation as the main satellite positions — just evaluated at different times. The trajectory is physically accurate within TLE precision (~1 km). Past trail renders in cyan, future in warm yellow, both fading toward the ends via vertex color intensity.

---

## Appendix: FCC Parameter Cross-Reference

This appendix systematically maps every simulation parameter to its FCC/ITU filing source (or documents the absence of one). Parameters are grouped by domain.

### Filing Index

| Citation Key | Filing Number | Date | Description | URL |
|-------------|--------------|------|-------------|-----|
| **FCC-LOA-2016** | SAT-LOA-20161115-00118 | Nov 2016 | Original Starlink application — 4,425 sats at 1,100–1,325 km | [fcc.report](https://fcc.report/IBFS/SAT-LOA-20161115-00118/1158350.pdf) |
| **FCC-MOD-2018** | SAT-MOD-20181108-00083 | Nov 2018 | Gen1 altitude reduction — 1,584 sats from 1,150 km → 550 km | [fcc.report](https://fcc.report/IBFS/SAT-MOD-20181108-00083/1569860.pdf) |
| **FCC-MOD-2020** | SAT-MOD-20200417-00037 | Apr 2020 | Gen1 3rd modification — lower remaining 2,824 sats to 540–570 km; ISL architecture | [fcc.report](https://fcc.report/IBFS/SAT-MOD-20200417-00037/2274316.pdf) |
| **FCC 21-48** | FCC 21-48 | Apr 2021 | Gen1 final authorization — 4,408 sats in 5 shells at 540–570 km | [docs.fcc.gov](https://docs.fcc.gov/public/attachments/fcc-21-48a1.pdf) |
| **FCC 22-91** | FCC 22-91 | Dec 2022 | Gen2 partial authorization — 7,500 sats at 525/530/535 km | [docs.fcc.gov](https://docs.fcc.gov/public/attachments/FCC-22-91A1.pdf) |
| **DA 26-36** | DA 26-36 | Jan 2026 | Gen2 upgrade — additional 7,500 sats at VLEO 340–485 km | [docs.fcc.gov](https://docs.fcc.gov/public/attachments/DA-26-36A1.pdf) |
| **SES-LIC-2020** | SES-LIC-INTR2020-02547 | 2020 | User terminal antenna patterns and EIRP specifications | [fcc.report](https://fcc.report/IBFS/SES-LIC-INTR2020-02547) |
| **Handley 2018** | — | 2018 | "Delay is Not an Option" — foundational LEO ISL routing paper | [ACM DL](https://dl.acm.org/doi/10.1145/3286062.3286075) |
| **Bhattacherjee & Singla 2019** | — | 2019 | "Network topology design at 27,000 km/hour" — ISL topology optimization | [PDF](https://bdebopam.github.io/papers/conext19_LEO_topology.pdf) |
| **Chaudhry & Yanikomeroglu 2021** | — | 2021 | "Laser Inter-Satellite Links in a Starlink Constellation" — ISL analysis | [arXiv](https://arxiv.org/pdf/2103.00056) |

### A. Orbital Shell Configuration

Code locations: `SHELL_TARGETS` and `SHELL_ALT_BANDS` in `src/lib/config.ts`

| Parameter | Simulation Value | FCC-Filed Value | Filing | Gap | Notes |
|-----------|-----------------|----------------|--------|-----|-------|
| 53° shell altitude | 460–570 km operational band | 550 km (Gen1), 525 km (Gen2) | FCC 21-48, FCC 22-91 | **Intentional divergence** | SGP4-observed clusters at 480–490 km (lowered Gen1) and 540–560 km; FCC specifies "center" altitude ±30 km |
| 53° shell sat count | `SHELL_TARGETS[2].target = 4408` | 1,584 (53.0°) + 1,584 (53.2°) + Gen2 | FCC 21-48, FCC 22-91 | **Validated** | 4,408 = sum of Gen1 53° shells (1,584 + 1,584 + remainder from other shells); Gen2 adds more at 525 km |
| 53° plane count | `SHELL_TARGETS[2].planes = 72` | 72 planes × 22 sats/plane (Gen1) | FCC 21-48 | **Validated** | Gen1 uses 72 planes across both 53° sub-shells |
| 43° shell altitude | 460–570 km band | 530 km (Gen2) | FCC 22-91 | **Intentional divergence** | Wide band to capture orbit-raising satellites; operational center matches filing |
| 43° shell sat count | `SHELL_TARGETS[1].target = 2000` | 2,500 authorized (Gen2) | FCC 22-91 | **Outdated** | Simulation uses 2,000; FCC 22-91 authorized 2,500 for 43° at 530 km |
| 33° shell altitude | 460–570 km band (placeholder) | 535 km (Gen2) | FCC 22-91 | **Validated** | Not yet launched; placeholder band is appropriate |
| 33° shell sat count | `SHELL_TARGETS[0].target = 2000` | 2,500 authorized (Gen2) | FCC 22-91 | **Outdated** | Simulation uses 2,000; FCC 22-91 authorized 2,500 for 33° at 535 km |
| 70° shell altitude | 460–910 km band | 570 km | FCC 21-48 | **Intentional divergence** | FCC authorized 570 km, but SGP4 observes ~880–900 km cluster; no FCC amendment found for higher altitude. Wide band captures both filed and observed altitudes |
| 70° shell sat count | `SHELL_TARGETS[3].target = 2000` | 720 (Gen1) | FCC 21-48 | **Intentional divergence** | Simulation target is aspirational (includes future Gen2); Gen1 filing authorized 720 in 36 planes × 20 sats |
| 97.6° shell altitude | 460–600 km band | 560 km | FCC 21-48 | **Validated** | SGP4-observed 550–590 km matches filed 560 km ±30 km |
| 97.6° shell sat count | `SHELL_TARGETS[4].target = 520` | 348 + 172 = 520 | FCC 21-48 | **Validated** | 6 planes × 58 sats + 4 planes × 43 sats = 520 total |
| VLEO shells | Not implemented | 340–485 km at 28°/32°/43°/53° | DA 26-36 | **Missing** | 7,500 additional sats authorized Jan 2026; not yet populated or modeled |

### B. Antenna / User Terminal

Code location: `MAX_STEERING_DEG`, `MIN_ELEVATION_DEG` in `src/lib/config.ts`

| Parameter | Simulation Value | FCC-Filed Value | Filing | Gap | Notes |
|-----------|-----------------|----------------|--------|-----|-------|
| Min elevation angle | `MIN_ELEVATION_DEG = 25` | 25° minimum operational elevation | FCC 21-48, FCC-MOD-2018 | **Validated** | FCC specifies 25° minimum for user terminals and gateways; gateways may use 5° above 62° latitude |
| Max steering angle | `MAX_STEERING_DEG = 25` | "100-degree field of view" (±50° from boresight) | SES-LIC-2020 | **Intentional divergence** | FCC filing describes a 100° FoV phased array (±50°), but gain degrades significantly past ~25° from boresight (33.2 dBi at boresight → 30.6 dBi at max slant). The 25° value represents the *practical* steering range for reliable service, not the hardware maximum |
| Antenna gain at boresight | Not modeled | 33.2 dBi (Rx), 34.6 dBi (Tx) | SES-LIC-2020 | **Missing** | No RF link budget computed |
| Antenna gain at max slant | Not modeled | 30.6 dBi (Rx), 32.0 dBi (Tx) | SES-LIC-2020 | **Missing** | ~2.6 dB scan loss at maximum steering |

### C. ISL Parameters

Code locations: `src/lib/config.ts`, `src/lib/satellites/isl-graph.ts`, `src/lib/satellites/isl-capability.ts`

| Parameter | Simulation Value | FCC-Filed / Published Value | Source | Gap | Notes |
|-----------|-----------------|---------------------------|--------|-----|-------|
| Terminals per satellite | 4 (2 in-plane, 2 cross-plane) | 4 laser terminals | FCC-MOD-2020 | **Validated** | Originally 5 (including cross-plane crossing link); SpaceX dropped to 4. The 2+2 topology matches the filing description |
| ISL max range | `ISL_MAX_RANGE_KM = 5016` | ~5,400 km demonstrated | SpaceX engineer statement (Travis Brashears) | **Validated** | Code uses 5,016 km (conservative); SpaceX demonstrated 5,400 km link. No FCC-filed maximum |
| Polar exclusion | `ISL_POLAR_EXCLUSION_DEG = 70` | Not filed | — | **Missing** | Engineering estimate: orbital planes converge near poles, increasing relative angular rate beyond gimbal tracking limits. Academic papers (Handley 2018, Bhattacherjee & Singla 2019) use similar cutoffs (~±75°) |
| OEO delay per hop | `ISL_PROCESSING_DELAY_MS = 0.3` | Not filed | — | **Missing** | Engineering estimate (0.2–0.4 ms range from academic literature). No FCC or SpaceX public specification |
| ISL capability (53°) | Launch year ≥ 2022 | v1.5 laser links from Sep 2021 (first full ISL batch launched Jan 2022) | SpaceX announcements | **Validated** | First v1.5 with lasers launched Sep 2021 from Vandenberg; first full ISL-equipped batch Jan 2022 |
| ISL capability (polar) | Launch year ≥ 2022 | Polar ISL from Jan 2021 (Transporter-1 mission) | SpaceX announcements | **Intentional divergence** | First polar laser sats launched Jan 2021; code uses 2022 cutoff (conservative — the Jan 2021 batch was 10 sats only) |
| ISL capability (43°) | Launch year ≥ 2023 | All v2 Mini have 4 laser terminals | SpaceX statements | **Validated** | 43° shell populated exclusively with v2 Mini, all ISL-equipped |
| Graph rebuild interval | `ISL_GRAPH_REBUILD_MS = 30000` | Not filed | — | **Missing** | Engineering choice — orbital plane topology is stable at 30s intervals |
| Max ISL hops | `ISL_MAX_HOPS = 6` | Not filed | — | **Missing** | Engineering estimate; typical routes 1–3 hops, 6 allows oceanic ISL bridging |

### D. Latency / Backhaul Model

Code locations: `src/lib/config.ts`, `src/lib/utils/backhaul-latency.ts`, `src/lib/utils/isl-pathfinder.ts`

| Parameter | Simulation Value | FCC-Filed / Published Value | Source | Gap | Notes |
|-----------|-----------------|---------------------------|--------|-----|-------|
| Base processing RTT | `BASE_PROCESSING_RTT_MS = 6` | Not filed | — | **Missing** | Engineering estimate: dish modem (~1 ms) + satellite bent-pipe (~0.3 ms) + GS RF (~0.5 ms) + GS→PoP network (~0.5 ms) × 2 directions ≈ 5–8 ms. No public specification |
| Fiber speed | `0.67c` (200,861 km/s) | Not filed | — | **Missing** | Standard telecom fiber: refractive index ~1.47 → c/1.47 ≈ 0.68c. The 0.67c value is slightly conservative but within accepted range |
| Fiber route factor | `1.4×` great-circle distance | Not filed | — | **Missing** | Standard industry estimate for terrestrial fiber path overhead vs. straight-line distance. Actual values vary (1.2× urban to 1.6× mountainous) |
| Router processing | `1.0 ms` per direction | Not filed | — | **Missing** | Standard estimate for router/switch processing delay |
| PoP–GS max distance | `POP_GS_MAX_DISTANCE_KM = 1500` | Not filed | — | **Missing** | Inferred from SpaceX's terrestrial backhaul contracts. Ireland→Frankfurt (~1,200 km) is borderline; Spain→Frankfurt (~1,800 km) is too far |
| Route hold time | `ROUTE_HOLD_MS = 30000` | Not filed | — | **Missing** | Engineering estimate matching observed real-network route stability (30–60s). Prevents per-second oscillation from ping jitter |
| Speed of light | `299,792.458 km/s` | Physical constant | — | **Validated** | Exact value of c in vacuum |

### E. Gateway / Ground Station

Code location: `src/lib/satellites/ground-stations.ts`, HF dataset `juliensimon/starlink-ground-stations`

| Parameter | Simulation Value | FCC-Filed / Published Value | Source | Gap | Notes |
|-----------|-----------------|---------------------------|--------|-----|-------|
| Station count | ~150+ (HF dataset) | Not specified as total | Various FCC Earth Station filings | **Partially verified** | US gateways filed individually with FCC IBFS; international gateways filed with national regulators (ARCEP, Ofcom, ACMA, etc.). No single filing enumerates all gateways |
| Gateway frequencies | Not modeled | Ku-band (10.7–14.5 GHz user), Ka-band (17.8–29.1 GHz gateway), E-band (Gen2) | FCC 22-91, DA 26-36 | **Missing** | App doesn't model frequency bands; relevant for rain fade and capacity |
| Gateway min elevation | Uses line-of-sight geometry | 25° (general), 5° (polar >62° latitude) | FCC 21-48 | **Intentional divergence** | Code uses geometric LoS check (effectively 0° cutoff) rather than the 25° filed minimum. This means the simulation may route to gateways that the real system would consider below minimum elevation |
| Station type classification | `gateway` / `pop` | Not distinguished in FCC filings | — | **Missing** | The gateway vs. PoP distinction is inferred from community data (rDNS patterns), not from filings |

### Parameters Without FCC Source

The following simulation parameters have **no FCC filing or public SpaceX specification** backing them. They are engineering estimates derived from academic literature, industry standards, or community observation:

| Parameter | Value | Basis | Code Location |
|-----------|-------|-------|---------------|
| ISL polar exclusion latitude | ±70° | Academic papers model similar cutoffs (±70–75°); based on gimbal tracking limits at orbital plane convergence | `config.ts:74` |
| OEO conversion delay | 0.3 ms/hop | Academic literature range (0.2–0.4 ms); no public spec | `config.ts:66` |
| Base processing RTT | 6 ms | Component-level estimate; community-observed pings suggest 5–8 ms non-propagation overhead | `config.ts:78` |
| Fiber backhaul speed | 0.67c | Standard telecom; slightly conservative vs. typical 0.68c | `backhaul-latency.ts:53` |
| Fiber route factor | 1.4× | Industry estimate for fiber path vs. great-circle | `backhaul-latency.ts:54` |
| PoP–GS backhaul limit | 1,500 km | Inferred from SpaceX backhaul contracts | `isl-pathfinder.ts:70` |
| Route hold duration | 30 s | Matches observed real-network route stability | `isl-pathfinder.ts:313` |
| ISL max hops | 6 | Simulation cap; typical routes 1–3 hops | `config.ts:68` |
| ISL graph rebuild interval | 30 s | Performance/accuracy tradeoff | `config.ts:69` |

### Methodology

**How filings were located:** FCC filings were accessed via [fcc.report](https://fcc.report) (IBFS search) and [docs.fcc.gov](https://docs.fcc.gov) (public attachments). Filing numbers cross-referenced against SpaceX's public docket history and the FCC's International Bureau Filing System. Academic papers sourced from ACM Digital Library and arXiv.

**Interpretation notes:**
- FCC-filed altitudes represent "center" altitude with ±30 km operational range (stated in FCC 21-48). The simulation's wider altitude bands (e.g., 460–570 km for the 53° shell) are intentional — they accommodate orbit-raising satellites and altitude drift between TLE updates.
- The 70° shell at 880–900 km (observed) vs. 570 km (filed) represents the largest filing-to-observation discrepancy. No FCC amendment was found authorizing this higher altitude. This may relate to Starshield operations or interim constellation management.
- Satellite counts in `SHELL_TARGETS` mix Gen1 (FCC 21-48) and Gen2 (FCC 22-91) targets. The 33° and 43° shell targets of 2,000 undercount the FCC 22-91 authorization of 2,500 each.
- The user terminal's 100° field of view (±50° from boresight, per SES-LIC-2020) is wider than the 25° steering cone used by the simulation. The simulation value reflects practical service range (where gain remains adequate), not hardware capability.

---

## Summary: What's Real vs. What's Inferred


| What you see                     | Where it comes from                          | How trustworthy                                                     |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| **Satellite positions**          | Public NORAD data + SGP4 math                | **Real** — same method everyone uses, ~1 km accuracy                |
| **Number of satellites**         | HF dataset (from CelesTrak catalog)          | **Real** — includes some non-operational objects                    |
| **Globe, coordinates, geometry** | WGS-84 standard + textbook math              | **Real** — zero assumptions                                         |
| **Dish stats (live mode)**       | Your dish's hardware API                     | **Real** — straight from the hardware                               |
| **Network path (live mode)**     | Traceroute + DNS lookup                      | **Real** — actual network measurement                               |
| **Ground station locations**     | HF dataset (Starlink Insider + FCC IBFS + rDNS) | **Mostly real** — gateways + PoPs loaded from HF, auto-updated daily; some may be missing |
| **Antenna steering range (25°)** | FCC filing (100° FoV) + practical gain cutoff | **Intentional divergence** — FCC allows ±50°, but gain degrades past ~25° (see Appendix §B) |
| **Which satellite you're on**    | Inferred from antenna + geometry             | **Probably right** — but no way to verify                           |
| **Satellite selection logic**    | Boresight alignment + path-length tiebreaker | **Simplified** — real logic involves fleet-wide optimization        |
| **Gateway assignment**           | PoP-constrained selection with ISL fallback   | **Predicted** — uses PoP constraint + LoS + ISL graph; real routing adds load balancing |
| **Handoff triggers**             | Elevation/boresight threshold                | **Simplified** — real triggers are centrally scheduled per-beam     |
| **Demo ping latency**            | Speed-of-light calculation from geometry     | **Physics-based** — correct propagation delay, estimated processing |
| **Demo throughput/SNR**          | Procedural sine waves                        | **Fake** — realistic-looking ranges, no physics                     |
| **Laser inter-satellite links**  | Predicted from launch year + 4-terminal graph | **Predicted** — 4-terminal topology matches FCC filing; ISL range/polar exclusion are estimates (see Appendix §C) |
| **RF link budget**               | Not computed                                 | **Missing** — would require proprietary antenna specs               |
| **Sky view az/el projection**    | ENU frame + spherical trig                   | **Real** — same math as antenna controllers                         |
| **Star positions**               | J2000 RA/Dec via GMST transform              | **Real** — standard astronomy, ~0.36° precession drift by 2026     |
| **Constellation patterns**       | IAU stick figures, spot-checked               | **Real** — all 88 IAU constellations, coordinates verified          |
| **Satellite sun/shadow**         | Cylindrical Earth shadow model               | **Approximation** — ignores ~40 km penumbra (negligible at LEO)    |
| **Sky gradient colors**          | Sun elevation phases                         | **Approximation** — visual, not physically-based scattering        |
| **Trajectory arcs**              | SGP4 propagation ±5 min                      | **Real** — same propagator, accurate within TLE precision           |


---

**For what it is — a public-data dashboard with live hardware integration — this is as accurate as it can be.** The assumptions are reasonable, the approximations are clearly bounded, and the gaps are in areas where no public data exists.
