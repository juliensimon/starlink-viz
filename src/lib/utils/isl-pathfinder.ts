/**
 * ISL pathfinder — PoP-constrained route selection with ISL fallback.
 *
 * Decision hierarchy:
 * 1. Constrain ground stations to those with backhaul to the user's detected PoP
 * 2. Check line-of-sight from serving satellite to PoP-constrained GSes
 * 3. If any are visible → direct (bent-pipe) route to nearest, lowest latency wins
 * 4. If none visible → ISL mandatory, BFS through laser link graph to find a
 *    satellite that can see a valid GS
 * 5. Route held for 30s unless exit satellite loses LoS to exit GS
 */

import { getPositionsArray, getISLCapableArray, getDetectedPop, type RoutePath } from '../satellites/satellite-store';
import { getISLGraph } from '../satellites/isl-graph';
import { geodeticToCartesian } from './coordinates';
import { computeGeometricLatency, computeISLRouteLatency, SPEED_OF_LIGHT_KM_S } from './geometric-latency';
import { GROUND_STATIONS, groundStationsVersion } from '../satellites/ground-stations';
import { GS_BACKHAUL_RTT_MS } from './backhaul-latency';
import { ISL_MAX_HOPS, ISL_PROCESSING_DELAY_MS, EARTH_RADIUS_KM } from '../config';

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Lazily computed ground station derived data — recomputed when groundStationsVersion changes
let gsPositions: ReturnType<typeof geodeticToCartesian>[] = [];
let operationalGSIndices: number[] = [];
let lastGSVersion = -1; // force initial compute

function ensureGSData(): void {
  if (lastGSVersion === groundStationsVersion) return;
  gsPositions = GROUND_STATIONS.map((gs) =>
    geodeticToCartesian(degToRad(gs.lat), degToRad(gs.lon), 0, 1),
  );
  // Operational gateway indices only (exclude planned stations and PoPs)
  operationalGSIndices = GROUND_STATIONS
    .map((gs, i) => (gs.status !== 'planned' && gs.type !== 'pop' ? i : -1))
    .filter((i) => i >= 0);
  // Invalidate PoP GS cache since station indices changed
  cachedPopGSIndices = null;
  cachedPopName = null;
  lastGSVersion = groundStationsVersion;
}

/**
 * PoP locations — maps the display name (from parsePopHostname) to lat/lon.
 * Traffic must exit at the user's assigned PoP, so only ground stations
 * with plausible backhaul to that PoP are valid routing endpoints.
 */
const POP_LOCATIONS: Record<string, { lat: number; lon: number }> = {
  'Frankfurt, DE':     { lat: 50.1109, lon: 8.6821 },
  'London, GB':        { lat: 51.5074, lon: -0.1278 },
  'Madrid, ES':        { lat: 40.4168, lon: -3.7038 },
  'Los Angeles, US':   { lat: 34.0522, lon: -118.2437 },
  'Seattle, US':       { lat: 47.6062, lon: -122.3321 },
  'Chicago, US':       { lat: 41.8781, lon: -87.6298 },
  'Washington DC, US': { lat: 39.0438, lon: -77.4874 },
  'Miami, US':         { lat: 25.7617, lon: -80.1918 },
  'Amsterdam, NL':     { lat: 52.3676, lon: 4.9041 },
  'Paris, FR':         { lat: 48.8566, lon: 2.3522 },
  'Singapore, SG':     { lat: 1.3521, lon: 103.8198 },
  'Sydney, AU':        { lat: -33.8688, lon: 151.2093 },
  'Tokyo, JP':         { lat: 35.6762, lon: 139.6503 },
  'Santiago, CL':      { lat: -33.4489, lon: -70.6693 },
};

/** Max backhaul distance (km) from a ground station to the PoP.
 *  SpaceX's terrestrial backhaul contracts keep GS-to-PoP fiber runs
 *  under ~1,500km. Ireland→Frankfurt (1,200km) is borderline;
 *  Spain→Frankfurt (1,800km) is too far. */
const POP_GS_MAX_DISTANCE_KM = 1500;

/** Haversine great-circle distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Get the set of operational GS indices that can serve the detected PoP.
 * Returns null if no PoP is detected (fall back to unconstrained).
 * Caches result until the PoP changes.
 */
let cachedPopGSIndices: number[] | null = null;
let cachedPopName: string | null = null;

function getPopConstrainedGSIndices(): number[] | null {
  const pop = getDetectedPop();
  if (!pop || pop === 'Unknown') return null;

  // Return cache if PoP hasn't changed
  if (pop === cachedPopName && cachedPopGSIndices) return cachedPopGSIndices;

  const popLoc = POP_LOCATIONS[pop];
  if (!popLoc) return null;

  cachedPopGSIndices = operationalGSIndices.filter((i) => {
    const gs = GROUND_STATIONS[i];
    return haversineKm(gs.lat, gs.lon, popLoc.lat, popLoc.lon) <= POP_GS_MAX_DISTANCE_KM;
  });

  // If too few GS match (< 3), the constraint is too tight — fall back
  if (cachedPopGSIndices.length < 3) {
    cachedPopGSIndices = null;
    cachedPopName = null;
    return null;
  }

  cachedPopName = pop;
  return cachedPopGSIndices;
}

/**
 * Find the top-N nearest ground stations to a position from a given index set.
 * Returns indices into GROUND_STATIONS.
 */
function findNearestGSIndices(
  pos: { x: number; y: number; z: number },
  topN: number,
  candidateIndices: number[],
): number[] {
  const n = Math.min(topN, candidateIndices.length);
  const result: number[] = [];
  const resultDist: number[] = [];

  for (const i of candidateIndices) {
    const gs = gsPositions[i];
    const dx = gs.x - pos.x, dy = gs.y - pos.y, dz = gs.z - pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (result.length < n) {
      result.push(i);
      resultDist.push(distSq);
      if (result.length === n) {
        sortTopN(result, resultDist);
      }
    } else if (distSq < resultDist[n - 1]) {
      result[n - 1] = i;
      resultDist[n - 1] = distSq;
      sortTopN(result, resultDist);
    }
  }

  return result;
}

/** Sort parallel arrays by distance (ascending). Only called for tiny arrays (n<=5). */
function sortTopN(indices: number[], dists: number[]): void {
  // Insertion sort — optimal for n<=5
  for (let i = 1; i < indices.length; i++) {
    const d = dists[i], idx = indices[i];
    let j = i - 1;
    while (j >= 0 && dists[j] > d) {
      dists[j + 1] = dists[j];
      indices[j + 1] = indices[j];
      j--;
    }
    dists[j + 1] = d;
    indices[j + 1] = idx;
  }
}

/**
 * Check if a satellite has line-of-sight to a ground station.
 * A GS is visible if the closest point on the sat→GS line segment
 * to the Earth's center is above the surface (radius > 1 in unit-sphere).
 *
 * Geometrically: the minimum distance from the origin to the line from
 * sat to GS must exceed 1.0 (Earth's unit-sphere radius).
 */
function hasLineOfSight(
  satPos: { x: number; y: number; z: number },
  gsPos: { x: number; y: number; z: number },
): boolean {
  // Vector from sat to GS
  const dx = gsPos.x - satPos.x;
  const dy = gsPos.y - satPos.y;
  const dz = gsPos.z - satPos.z;
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq === 0) return true;

  // Project origin onto the line sat→GS: t = -dot(sat, dir) / |dir|²
  const t = -(satPos.x * dx + satPos.y * dy + satPos.z * dz) / lenSq;
  const tClamped = Math.max(0, Math.min(1, t));

  // Closest point on segment to origin
  const cx = satPos.x + tClamped * dx;
  const cy = satPos.y + tClamped * dy;
  const cz = satPos.z + tClamped * dz;
  const closestDistSq = cx * cx + cy * cy + cz * cz;

  // Must clear Earth's surface (unit sphere radius = 1)
  // Use 1.0 exactly — GS is on the surface, so the line grazing the
  // surface at t=1 is fine (that's the GS itself).
  return closestDistSq >= 1.0;
}

/**
 * Check if any ground station in the given index set has line-of-sight
 * to the satellite. Returns the indices that are visible.
 */
function findVisibleGSIndices(
  satPos: { x: number; y: number; z: number },
  gsIndexSet: number[],
): number[] {
  const visible: number[] = [];
  for (const i of gsIndexSet) {
    if (hasLineOfSight(satPos, gsPositions[i])) {
      visible.push(i);
    }
  }
  return visible;
}

/**
 * Compute one-way latency (ms) for a single segment in unit-sphere coords.
 */
function segmentLatencyMs(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const distKm = Math.sqrt(dx * dx + dy * dy + dz * dz) * EARTH_RADIUS_KM;
  return (distKm / SPEED_OF_LIGHT_KM_S) * 1000;
}

/**
 * Node in the search graph. Uses parent pointer instead of copying the
 * full path at each expansion (#3 fix).
 */
interface SearchNode {
  satIndex: number;
  latencyMs: number;  // accumulated one-way latency from connected sat
  hops: number;
  parent: number;     // index into the settled[] array, or -1 for root
}

/** Reconstruct path from settled nodes by following parent pointers. */
function reconstructPath(settled: SearchNode[], nodeIdx: number): number[] {
  const path: number[] = [];
  let cur = nodeIdx;
  while (cur >= 0) {
    path.push(settled[cur].satIndex);
    cur = settled[cur].parent;
  }
  path.reverse();
  return path;
}

// --- Route decision log ---
// Inspect from browser console: window.__ISL_ROUTE_LOG

export interface RouteDecisionEntry {
  time: string;
  action: 'hold' | 'hold-invalid' | 'new' | 'fallback' | 'no-path';
  reason: string;
  route: {
    type: 'direct' | 'isl';
    hops: number;
    gs: string;
    latencyMs: number;
  } | null;
  context: {
    popConstrained: boolean;
    pop: string | null;
    islMandatory: boolean;
    islCapable: boolean;
    visibleGSCount: number;
    directCandidates: number;
    islCandidates: number;
    measuredPing: number | null;
    holdTimeRemaining: number;
  };
}

const ROUTE_LOG_MAX = 50;
const routeLog: RouteDecisionEntry[] = [];

function logRouteDecision(entry: RouteDecisionEntry): void {
  routeLog.push(entry);
  if (routeLog.length > ROUTE_LOG_MAX) routeLog.shift();

  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__ISL_ROUTE_LOG = routeLog;
    // Fire-and-forget POST to server — writes to isl-route.log
    fetch('/api/isl-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }
}

export function getRouteLog(): RouteDecisionEntry[] {
  return routeLog;
}

// --- Route stability ---
// The real network control plane holds routes for 30s–minutes. We apply
// hysteresis: keep the current route unless a new route is significantly
// better, preventing per-second oscillation from ping jitter.

let previousRoute: RoutePath | null = null;
let previousRouteTime = 0;

/** Hard hold time (ms) — during this window, the route only changes if
 *  the current route becomes geometrically invalid (exit sat lost LoS to GS).
 *  Real Starlink holds routes for 30–60s. */
const ROUTE_HOLD_MS = 30000;

function routeSummary(r: RoutePath): RouteDecisionEntry['route'] {
  return {
    type: r.type,
    hops: r.hopCount,
    gs: GROUND_STATIONS[r.groundStationIndex]?.name ?? `GS#${r.groundStationIndex}`,
    latencyMs: Math.round(r.latencyMs * 10) / 10,
  };
}

/**
 * Find the best route from the connected satellite.
 * Picks lowest geometric latency among PoP-constrained, LoS-visible GSes.
 * ISL routes are only explored when no valid GS is directly visible.
 */
export function findBestRoute(
  connectedSatIndex: number,
  dishPos: { x: number; y: number; z: number },
  measuredPing: number | null,
): RoutePath | null {
  ensureGSData();

  const positions = getPositionsArray();
  const islCapable = getISLCapableArray();
  const graph = getISLGraph();

  if (!positions) return null;

  const satPos = posAt(positions, connectedSatIndex);
  if (!satPos) return null;

  // Reset hysteresis on satellite handoff — previous route is invalid
  if (previousRoute && previousRoute.satelliteIndices[0] !== connectedSatIndex) {
    previousRoute = null;
    previousRouteTime = 0;
  }

  // Use PoP-constrained GS set if available — traffic must exit at the
  // user's assigned PoP, so only GSes with backhaul to that PoP are valid.
  const popGSIndices = getPopConstrainedGSIndices();
  const gsIndices = popGSIndices ?? operationalGSIndices;

  // Check if any PoP-constrained GS has line-of-sight to the serving satellite.
  // If not, ISL is mandatory — the satellite can't reach any valid GS directly.
  const visiblePopGS = findVisibleGSIndices(satPos, gsIndices);
  const islMandatory = popGSIndices !== null && visiblePopGS.length === 0;

  const detectedPop = getDetectedPop();
  const satIsIslCapable = !!(islCapable && islCapable[connectedSatIndex]);

  // 1. Evaluate direct routes (only if LoS exists to PoP-constrained GSes)
  const directRoutes: RoutePath[] = [];

  if (!islMandatory) {
    // Use visible GSes for direct routes — no point evaluating GSes the sat can't see
    const directCandidates = visiblePopGS.length > 0 ? visiblePopGS : gsIndices;
    const nearestGSes = findNearestGSIndices(satPos, 5, directCandidates);

    for (const gsIdx of nearestGSes) {
      const latency = computeGeometricLatency(dishPos, satPos, gsPositions[gsIdx]) + GS_BACKHAUL_RTT_MS[gsIdx];
      directRoutes.push({
        type: 'direct',
        satelliteIndices: [connectedSatIndex],
        groundStationIndex: gsIdx,
        latencyMs: latency,
        hopCount: 0,
      });
    }
  }

  // 2. ISL routes — only explored when mandatory (no PoP GS visible from
  //    serving satellite). When direct routes exist, ISL is not used as an
  //    optimization — real Starlink only ISL-routes when it has to.
  const islRoutes: RoutePath[] = [];

  if (islMandatory && islCapable && islCapable[connectedSatIndex] && graph) {
    // Bounded BFS with greedy extraction from connected satellite.
    const visited = new Set<number>();
    const settled: SearchNode[] = [];

    const queue: { satIndex: number; latencyMs: number; hops: number; parentSettledIdx: number }[] = [{
      satIndex: connectedSatIndex,
      latencyMs: 0,
      hops: 0,
      parentSettledIdx: -1,
    }];

    while (queue.length > 0) {
      // Pop lowest-latency node (linear scan — queue stays small due to caps)
      let minIdx = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].latencyMs < queue[minIdx].latencyMs) minIdx = i;
      }
      const qNode = queue[minIdx];
      queue[minIdx] = queue[queue.length - 1];
      queue.pop();

      if (visited.has(qNode.satIndex)) continue;
      visited.add(qNode.satIndex);

      const settledIdx = settled.length;
      settled.push({
        satIndex: qNode.satIndex,
        latencyMs: qNode.latencyMs,
        hops: qNode.hops,
        parent: qNode.parentSettledIdx,
      });

      // At each ISL hop, check if any PoP-constrained GS is now visible
      if (qNode.hops > 0) {
        const nodePos = posAt(positions, qNode.satIndex);
        if (nodePos) {
          // Only consider PoP-constrained GSes that this satellite can actually see
          const visibleFromHere = findVisibleGSIndices(nodePos, gsIndices);
          if (visibleFromHere.length > 0) {
            const pathIndices = reconstructPath(settled, settledIdx);
            const satPositions = pathIndices.map((si) => posAt(positions, si)!).filter(Boolean);
            const gsNear = findNearestGSIndices(nodePos, 3, visibleFromHere);
            for (const gsIdx of gsNear) {
              const routeLatency = computeISLRouteLatency(dishPos, satPositions, gsPositions[gsIdx]) + GS_BACKHAUL_RTT_MS[gsIdx];
              islRoutes.push({
                type: 'isl',
                satelliteIndices: pathIndices,
                groundStationIndex: gsIdx,
                latencyMs: routeLatency,
                hopCount: qNode.hops,
              });
            }
          }
        }
      }

      // Expand to ISL neighbors
      if (qNode.hops >= ISL_MAX_HOPS) continue;
      if (qNode.latencyMs > 40) continue; // Cap one-way ISL accumulation at 40ms (~5 hops)

      const start = graph.neighborOffsets[qNode.satIndex];
      const end = graph.neighborOffsets[qNode.satIndex + 1];

      for (let e = start; e < end; e++) {
        const neighbor = graph.neighborIndices[e];
        if (visited.has(neighbor)) continue;

        const neighborPos = posAt(positions, neighbor);
        const nodePos = posAt(positions, qNode.satIndex);
        if (!neighborPos || !nodePos) continue;

        const hopLatency = segmentLatencyMs(nodePos, neighborPos) + ISL_PROCESSING_DELAY_MS;
        queue.push({
          satIndex: neighbor,
          latencyMs: qNode.latencyMs + hopLatency,
          hops: qNode.hops + 1,
          parentSettledIdx: settledIdx,
        });
      }
    }
  }

  // 3. Route selection with hysteresis
  //
  // ISL routes only exist when mandatory (no PoP GS visible). Otherwise
  // only direct routes are candidates.
  const candidateRoutes = islMandatory ? islRoutes : directRoutes;

  const now = Date.now();

  // Shared context for all log entries this invocation
  const logCtx: RouteDecisionEntry['context'] = {
    popConstrained: popGSIndices !== null,
    pop: detectedPop,
    islMandatory,
    islCapable: satIsIslCapable,
    visibleGSCount: visiblePopGS.length,
    directCandidates: directRoutes.length,
    islCandidates: islRoutes.length,
    measuredPing: measuredPing !== null ? Math.round(measuredPing * 10) / 10 : null,
    holdTimeRemaining: previousRoute ? Math.max(0, ROUTE_HOLD_MS - (now - previousRouteTime)) : 0,
  };

  if (candidateRoutes.length === 0) {
    // No valid PoP-constrained route found this cycle.
    // If ISL is mandatory and we had a previous ISL route, hold it —
    // the graph is momentarily sparse but the route likely still works.
    // The real system doesn't drop to unconstrained routing when the
    // topology momentarily lacks a path.
    if (islMandatory && previousRoute && previousRoute.type === 'isl') {
      // Recompute latency with current positions
      const exitSatPos = posAt(positions, previousRoute.satelliteIndices[previousRoute.satelliteIndices.length - 1]);
      const exitGSPos = gsPositions[previousRoute.groundStationIndex];
      if (exitSatPos && exitGSPos) {
        const satPositions = previousRoute.satelliteIndices.map((si) => posAt(positions, si)!).filter(Boolean);
        if (satPositions.length > 0) {
          previousRoute = {
            ...previousRoute,
            latencyMs: computeISLRouteLatency(dishPos, satPositions, exitGSPos) + GS_BACKHAUL_RTT_MS[previousRoute.groundStationIndex],
          };
        }
      }
      logRouteDecision({ time: new Date().toISOString(), action: 'hold', reason: 'ISL mandatory, no new candidates — holding previous ISL route', route: routeSummary(previousRoute), context: logCtx });
      return previousRoute;
    }

    // When ISL is mandatory, never fall back to an unconstrained GS — the
    // nearest GS (e.g. Punta Arenas for Point Nemo) may be beyond the
    // satellite's LoS horizon and the route would be physically impossible.
    // Clear any stale fallback so the hard-hold below doesn't preserve it.
    if (islMandatory) {
      previousRoute = null;
      previousRouteTime = 0;
      logRouteDecision({ time: new Date().toISOString(), action: 'no-path', reason: 'ISL mandatory, no path found', route: null, context: logCtx });
      return null;
    }

    // Non-ISL fallback: try direct routes first, then unconstrained nearest GS.
    if (directRoutes.length > 0) {
      previousRoute = directRoutes[0];
      previousRouteTime = now;
      logRouteDecision({ time: new Date().toISOString(), action: 'fallback', reason: 'no candidates, using direct', route: routeSummary(previousRoute), context: logCtx });
      return previousRoute;
    }
    const fallbackGS = findNearestGSIndices(satPos, 1, operationalGSIndices);
    if (fallbackGS.length > 0) {
      const latency = computeGeometricLatency(dishPos, satPos, gsPositions[fallbackGS[0]]) + GS_BACKHAUL_RTT_MS[fallbackGS[0]];
      previousRoute = { type: 'direct', satelliteIndices: [connectedSatIndex], groundStationIndex: fallbackGS[0], latencyMs: latency, hopCount: 0 };
      previousRouteTime = now;
      logRouteDecision({ time: new Date().toISOString(), action: 'fallback', reason: 'no candidates, unconstrained nearest GS', route: routeSummary(previousRoute), context: logCtx });
      return previousRoute;
    }
    previousRoute = null;
    logRouteDecision({ time: new Date().toISOString(), action: 'fallback', reason: 'no route found', route: null, context: logCtx });
    return null;
  }

  // Hard hold: keep current route unless geometrically invalid.
  // Skip hold when ISL is mandatory but the held route is direct — that
  // would be a stale phantom route to a beyond-horizon GS.
  if (previousRoute && now - previousRouteTime < ROUTE_HOLD_MS &&
      !(islMandatory && previousRoute.type === 'direct')) {
    const exitSatIdx = previousRoute.satelliteIndices[previousRoute.satelliteIndices.length - 1];
    const exitSatPos = posAt(positions, exitSatIdx);
    const exitGSPos = gsPositions[previousRoute.groundStationIndex];

    const stillValid = exitSatPos && exitGSPos && hasLineOfSight(exitSatPos, exitGSPos);

    if (stillValid) {
      // Recompute latency with current positions but keep route structure
      if (previousRoute.type === 'isl' && previousRoute.satelliteIndices.length > 1) {
        const satPositions = previousRoute.satelliteIndices.map((si) => posAt(positions, si)!).filter(Boolean);
        if (satPositions.length > 0) {
          previousRoute = {
            ...previousRoute,
            latencyMs: computeISLRouteLatency(dishPos, satPositions, exitGSPos) + GS_BACKHAUL_RTT_MS[previousRoute.groundStationIndex],
          };
        }
      } else {
        previousRoute = {
          ...previousRoute,
          latencyMs: computeGeometricLatency(dishPos, satPos, exitGSPos) + GS_BACKHAUL_RTT_MS[previousRoute.groundStationIndex],
        };
      }
      logRouteDecision({ time: new Date().toISOString(), action: 'hold', reason: `valid, ${Math.round(logCtx.holdTimeRemaining / 1000)}s remaining`, route: routeSummary(previousRoute), context: logCtx });
      return previousRoute;
    }
    // Route became invalid
    logRouteDecision({ time: new Date().toISOString(), action: 'hold-invalid', reason: 'exit sat lost LoS to GS', route: routeSummary(previousRoute), context: logCtx });
  }

  // Pick the best new route — lowest geometric latency wins.
  // Previously this chased measured ping ("closest to ping") which caused
  // oscillation between distant GSes as ping fluctuated. The nearest
  // PoP-constrained GS is almost always the correct answer.
  let bestNew = candidateRoutes[0];
  for (let i = 1; i < candidateRoutes.length; i++) {
    if (candidateRoutes[i].latencyMs < bestNew.latencyMs) {
      bestNew = candidateRoutes[i];
    }
  }

  const prevSummary = previousRoute ? `${previousRoute.type}→${GROUND_STATIONS[previousRoute.groundStationIndex]?.name}` : 'none';
  const newSummary = `${bestNew.type}→${GROUND_STATIONS[bestNew.groundStationIndex]?.name}`;
  const reason = previousRoute
    ? `switch from ${prevSummary} to ${newSummary} (hold expired or first route)`
    : `initial route: ${newSummary}`;

  previousRoute = bestNew;
  previousRouteTime = now;
  logRouteDecision({ time: new Date().toISOString(), action: 'new', reason, route: routeSummary(bestNew), context: logCtx });
  return bestNew;
}

function posAt(positions: Float32Array, index: number): { x: number; y: number; z: number } | null {
  const pi = index * 3;
  const x = positions[pi], y = positions[pi + 1], z = positions[pi + 2];
  if (x === 0 && y === 0 && z === 0) return null;
  return { x, y, z };
}
