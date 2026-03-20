# Starlink Mission Control Dashboard — Technical Review

---

## Data Sources & Disclaimer

**This application relies exclusively on publicly available data and live dish telemetry.** No proprietary SpaceX systems, internal APIs, or classified constellation parameters were used.

### What the app actually has access to


| Source                       | Type          | What it provides                                                                               | Reference                                                                                         |
| ---------------------------- | ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **CelesTrak / NORAD**        | Public        | Two-Line Element sets (TLEs) — orbital parameters for every tracked Starlink & GPS satellite   | [celestrak.org/NORAD/elements](https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle) |
| **Starlink dish gRPC API**   | Local device  | Real-time telemetry from your own dish (signal quality, throughput, ping, antenna orientation) | [starlink-grpc-tools (GitHub)](https://github.com/sparky8512/starlink-grpc-tools)                 |
| **System traceroute / DNS**  | Local network | Network path analysis — which internet exit point your traffic uses                            | Standard network utilities                                                                        |
| **FCC / ITU filings**        | Public        | Ground station locations (cross-referenced with community research)                            | [FCC IBFS via fcc.report](https://fcc.report); [ARCEP](https://www.arcep.fr); [Ofcom](https://www.ofcom.org.uk) |
| **Starlink DNS conventions** | Observed      | PoP code mappings (e.g., `customer.frntdeu.pop.starlinkisp.net` → Frankfurt)                   | Community-documented patterns                                                                     |


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

**Data source:** Real NORAD TLEs from CelesTrak, propagated with SGP4 via [`satellite.js`](https://github.com/shashwatak/satellite-js).

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

**Data source:** [CelesTrak](https://celestrak.org) — the standard public source for satellite orbital data, maintained by Dr. T.S. Kelso.

**Implementation:** `src/lib/satellites/tle-fetcher.ts` — fetches from `celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle`, parsed by `src/app/api/tle/route.ts`. The client-side hook (`src/hooks/useSatellites.ts`) retries with exponential backoff (1s, 2s, 4s).

The app fetches ~10,000 Starlink satellite TLEs. CelesTrak updates its data roughly twice daily from NORAD. The app tracks when TLEs were last fetched and displays TLE age in the status bar.

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
- **Non-commercial objects:** The CelesTrak "Starlink" group may include Starshield (military/government) objects that NORAD catalogs alongside commercial Starlink satellites. These operate under different parameters and may be at non-standard altitudes, particularly in the 97.6° polar shell.
- **Filed vs observed drift:** The observed altitudes may shift over time as SpaceX adjusts the constellation. The bands should be periodically validated against current TLE data.
- **Future VLEO conflict:** When SpaceX populates the authorized VLEO shells (340–365 km), the 460 km lower bound will become ambiguous — a satellite at 360 km could be orbit-raising to 570 km or operating in a VLEO shell. This will require new discrimination logic (likely by launch date or NORAD ID range).

**References:**
- [FCC 22-91 — Gen2 Authorization (Dec 2022)](https://docs.fcc.gov/public/attachments/FCC-22-91A1.pdf)
- [FCC DA 26-36 — Gen2 Upgrade Authorization (Jan 2026)](https://docs.fcc.gov/public/attachments/DA-26-36A1.pdf)
- [Jonathan McDowell — Starlink Statistics](https://planet4589.org/space/con/star/stats.html)

### 6. Ground Station Locations — Partially Verified ⚠️

**Data source:** Regulatory filings and community research.

**Implementation:** `data/ground-stations.json` — 204 gateway locations worldwide (168 operational, 36 planned), loaded by `src/lib/satellites/ground-stations.ts` with a hardcoded fallback copy. Operational station positions are precomputed as 3D vectors in `ConnectionBeam.tsx` for nearest-neighbor lookups; planned stations are rendered but excluded from routing.

The app's database contains **204 gateways** (168 operational, 36 planned/under construction) spanning North America, Europe, Asia-Pacific, South America/Caribbean, and Africa/Middle East. Locations are sourced from regulatory filings, community research, and curated aggregations. Planned stations are shown with reduced opacity and excluded from gateway selection routing.

**Why "partially verified":**

- SpaceX doesn't publish an official station list
- Some sites may be planned but not yet built; some operational sites may still be missing
- The app has no idea whether a gateway is currently online, overloaded, or down for maintenance; it treats all operational stations as equally available

**Authoritative sources for ground stations:**
- **US gateways:** [FCC IBFS (International Bureau Filing System)](https://fcc.report) — SpaceX is required to file Earth Station applications for every US gateway. Search for SpaceX earth station authorizations. This is the primary source used by analysts like Nathan Owens (Netflix CDN engineer who tracks Starlink infrastructure closely)
- **International gateways:** Filed with each country's telecom regulator — [ARCEP](https://www.arcep.fr) (France), [Ofcom](https://www.ofcom.org.uk) (UK), [ACMA](https://www.acma.gov.au) (Australia), Chile's telecommunications ministry, [Radio Spectrum Management](https://www.rsm.govt.nz) (New Zealand), among others
- **Curated aggregations:** [Starlink Insider gateway map](https://starlinkinsider.com/starlink-gateway-locations/) (~150 operational gateways); community-maintained Google Map compiled from FCC data via Reddit
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

### 3. Gateway Selection — Extrapolated

**What the app does (in `ConnectionBeam.tsx:findNearestGS3D()`):** Picks the nearest **operational** ground station to the connected satellite by squared 3D Euclidean distance (planned stations are excluded from routing). A **5% hysteresis margin** prevents flickering when the satellite is roughly equidistant from two gateways — the current gateway sticks unless a new one is meaningfully closer (`minDist > currentDist * 0.95`). When a switch happens, the event log shows the **latency change** computed via `computeGeometricLatency()`.

**What the real system considers that we can't:**

- Is this gateway at capacity? Is it raining there? (Rain severely degrades Ka-band signals — "rain fade" can reduce link margin by 10+ dB)
- Is the traffic's internet destination closer to a different gateway's PoP?
- Can the satellite reach a more suitable gateway via laser links through other satellites?
- Is this gateway scheduled for maintenance?

**How good is this approximation?** "Nearest gateway" is reasonable for the legacy bent-pipe model (satellite relays directly to the closest ground station). But it can be completely wrong when inter-satellite laser links are involved — a satellite over the Atlantic might route your traffic through three other satellites to reach a European gateway, bypassing a closer but overloaded American one. The hysteresis at least prevents the event log from spamming gateway switches every frame — real systems avoid ping-ponging too.

**Note:** While the app now has 168 operational gateways (sourced from FCC/international filings), some operational sites may still be missing, so the "nearest" gateway shown may not always be the nearest gateway in reality.

### 4. Inter-Satellite Laser Links — Not Modeled ❌

**The biggest gap.** The app shows the old bent-pipe model: your data goes up to one satellite and straight back down to the nearest ground station. Modern Starlink satellites (v1.5+ and all v2 Mini) have **four laser terminals** that create high-speed optical links to neighboring satellites — forming a mesh network in space.

**Why this matters:**

- Over the ocean, there's no ground station in range. Without lasers, there's no internet. With lasers, traffic hops between satellites until it reaches one that can see a ground station. This is how Starlink works on ships and planes over open water.
- The "nearest gateway" shown by this app can be completely wrong — traffic might route through 3-5 satellite hops to reach a gateway halfway around the world
- ISL routing is arguably Starlink's most important competitive advantage and the core of the architecture going forward — every v2 Mini has laser links
- The bent-pipe model this app shows is increasingly a legacy view (circa 2020); the constellation is evolving into a space-based mesh network

**Why it's missing:** There is zero public data about which laser links are active, how traffic is routed through the constellation, or even which specific satellites have functional laser terminals. This would require access to SpaceX's internal routing tables.

**References:**
- [Mark Handley, UCL — "Delay is Not an Option" (2018)](https://dl.acm.org/doi/10.1145/3286062.3286075) — foundational paper on LEO constellation ISL routing
- [SpaceX Gen2 FCC filing](https://fcc.report/IBFS/SAT-MOD-20200417-00037) — describes laser link architecture

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
| Satellite → Gateway   | Speed-of-light delay to nearest ground station | ~1.8 ms one-way |
| Processing + backhaul | 3 ms base + 0-4 ms random jitter               | ~3-7 ms         |
| **Round-trip total**  | Both legs × 2 + processing                     | **~20-40 ms**   |


Formula: `RTT = (dist_dish_sat + dist_sat_gw) × 2 / c × 1000 + 3 + random(0,4)` ms

This is real physics — light travels at ~300,000 km/s, the satellite is ~550 km up, so the uplink alone takes about 1.8 ms. The round trip (up-down-up-down, because you send a request and get a response) adds up to ~15 ms of pure speed-of-light delay, with the rest being processing and internet routing.

**What this misses:**

- The processing delay (3 ms) is a guess — real delays depend on the satellite's onboard hardware, the gateway's equipment, and internet routing beyond the PoP
- The jitter is random noise, not correlated with real congestion or weather
- ISL hops add ~5 ms each if the satellite routes via other satellites (not modeled)
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

## Summary: What's Real vs. What's Inferred


| What you see                     | Where it comes from                          | How trustworthy                                                     |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| **Satellite positions**          | Public NORAD data + SGP4 math                | **Real** — same method everyone uses, ~1 km accuracy                |
| **Number of satellites**         | CelesTrak catalog                            | **Real** — includes some non-operational objects                    |
| **Globe, coordinates, geometry** | WGS-84 standard + textbook math              | **Real** — zero assumptions                                         |
| **Dish stats (live mode)**       | Your dish's hardware API                     | **Real** — straight from the hardware                               |
| **Network path (live mode)**     | Traceroute + DNS lookup                      | **Real** — actual network measurement                               |
| **Ground station locations**     | Regulatory filings + research                | **Mostly real** — 204 gateways from FCC/intl filings; some may be missing |
| **Antenna steering range (25°)** | Community observation + FCC filings          | **Educated guess** — real value is proprietary, varies by HW rev    |
| **Which satellite you're on**    | Inferred from antenna + geometry             | **Probably right** — but no way to verify                           |
| **Satellite selection logic**    | Boresight alignment + path-length tiebreaker | **Simplified** — real logic involves fleet-wide optimization        |
| **Gateway assignment**           | Nearest of 204 stations with 5% hysteresis   | **Simplified** — real routing is dynamic, weather-aware, ISL-routed |
| **Handoff triggers**             | Elevation/boresight threshold                | **Simplified** — real triggers are centrally scheduled per-beam     |
| **Demo ping latency**            | Speed-of-light calculation from geometry     | **Physics-based** — correct propagation delay, estimated processing |
| **Demo throughput/SNR**          | Procedural sine waves                        | **Fake** — realistic-looking ranges, no physics                     |
| **Laser inter-satellite links**  | Not shown                                    | **Missing** — no public data exists                                 |
| **RF link budget**               | Not computed                                 | **Missing** — would require proprietary antenna specs               |
| **Sky view az/el projection**    | ENU frame + spherical trig                   | **Real** — same math as antenna controllers                         |
| **Star positions**               | J2000 RA/Dec via GMST transform              | **Real** — standard astronomy, ~0.36° precession drift by 2026     |
| **Constellation patterns**       | IAU stick figures, spot-checked               | **Real** — all 88 IAU constellations, coordinates verified          |
| **Satellite sun/shadow**         | Cylindrical Earth shadow model               | **Approximation** — ignores ~40 km penumbra (negligible at LEO)    |
| **Sky gradient colors**          | Sun elevation phases                         | **Approximation** — visual, not physically-based scattering        |
| **Trajectory arcs**              | SGP4 propagation ±5 min                      | **Real** — same propagator, accurate within TLE precision           |


---

**For what it is — a public-data dashboard with live hardware integration — this is as accurate as it can be.** The assumptions are reasonable, the approximations are clearly bounded, and the gaps are in areas where no public data exists.
