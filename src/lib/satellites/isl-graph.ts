/**
 * ISL neighbor graph using CSR (Compressed Sparse Row) encoding.
 *
 * Each ISL-capable satellite has up to 4 laser terminals:
 * - 2 in-plane: nearest forward/backward in same orbital plane
 * - 2 cross-plane: nearest satellites in adjacent orbital planes
 *
 * Rebuild every ~30s — orbital plane topology is stable at this frequency.
 */

import { getPositionsArray, getSatelliteCount, getInclinationsArray, getRAANArray, getISLCapableArray } from './satellite-store';
import { ISL_MAX_RANGE_KM, EARTH_RADIUS_KM, ISL_POLAR_EXCLUSION_DEG } from '../config';

const ISL_MAX_RANGE_UNIT = ISL_MAX_RANGE_KM / EARTH_RADIUS_KM;
const ISL_MAX_RANGE_SQ = ISL_MAX_RANGE_UNIT * ISL_MAX_RANGE_UNIT;

// Sine of the polar exclusion latitude — satellites with |Y/r| above this
// threshold are too close to the poles for cross-plane laser tracking.
const POLAR_EXCLUSION_SIN = Math.sin(ISL_POLAR_EXCLUSION_DEG * Math.PI / 180);

export interface ISLGraph {
  neighborOffsets: Uint32Array;   // CSR offsets: neighbors of sat i at [offsets[i]..offsets[i+1])
  neighborIndices: Uint32Array;   // flat neighbor list (#6: Uint32 for future constellation growth)
  timestamp: number;
}

interface PlaneGroup {
  planeRaan: number;
  indices: number[];
}

let cachedGraph: ISLGraph | null = null;

export function getISLGraph(): ISLGraph | null {
  return cachedGraph;
}

/**
 * Compute argument of latitude: the angle of a satellite's position within
 * its orbital plane, measured from the ascending node direction.
 *
 * Given the orbital plane defined by (inclination, RAAN), we construct two
 * orthonormal basis vectors in the plane:
 *   nodeVec = ascending node direction (in equatorial plane at longitude = RAAN)
 *   crossVec = orbitNormal × nodeVec (perpendicular to nodeVec, in the orbital plane)
 *
 * The argument of latitude is atan2(pos · crossVec, pos · nodeVec).
 *
 * Coordinate system: X = cos(lat)cos(lon), Y = sin(lat), Z = -cos(lat)sin(lon)
 * so Y is the pole, XZ is the equatorial plane.
 */
function argumentOfLatitude(
  px: number, py: number, pz: number,
  raanRad: number, incRad: number,
): number {
  // Ascending node direction (in equatorial XZ plane at longitude = RAAN)
  const nx = Math.cos(raanRad);
  const nz = -Math.sin(raanRad);
  // ny = 0

  // Orbit normal from r × v at ascending node:
  //   h = (sin(i)sin(Ω), cos(i), sin(i)cos(Ω))
  // We negate the XZ components, which reverses the angular direction
  // but produces the same set of adjacent pairs in the sorted ring.
  const sinI = Math.sin(incRad);
  const cosI = Math.cos(incRad);
  const hx = -sinI * Math.sin(raanRad);
  const hy = cosI;
  const hz = -sinI * Math.cos(raanRad);

  // crossVec = h × nodeVec (perpendicular to nodeVec, in orbital plane)
  // h × n where n = (nx, 0, nz):
  //   cx = hy*nz - hz*0 = hy*nz
  //   cy = hz*nx - hx*nz
  //   cz = hx*0 - hy*nx = -hy*nx
  const cx = hy * nz;
  const cy = hz * nx - hx * nz;
  const cz = -hy * nx;

  // Project position onto the two basis vectors
  const dotNode = px * nx + pz * nz;           // py * 0 = 0
  const dotCross = px * cx + py * cy + pz * cz;

  return Math.atan2(dotCross, dotNode);
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Build the ISL neighbor graph from current satellite state.
 * Returns null if insufficient data is available.
 */
export function buildISLGraph(): ISLGraph | null {
  const positions = getPositionsArray();
  const count = getSatelliteCount();
  const inclinations = getInclinationsArray();
  const raans = getRAANArray();
  const islCapable = getISLCapableArray();

  if (!positions || !inclinations || !raans || !islCapable || count === 0) return null;

  // Collect ISL-capable satellite indices grouped by shell
  const shells: Map<string, number[]> = new Map();

  for (let i = 0; i < count; i++) {
    if (!islCapable[i]) continue;
    const pi = i * 3;
    if (positions[pi] === 0 && positions[pi + 1] === 0 && positions[pi + 2] === 0) continue;

    const inc = inclinations[i];
    let shellKey: string;
    if (inc >= 80) shellKey = 'polar';
    else if (inc >= 60) shellKey = '70';
    else if (inc >= 48) shellKey = '53';
    else if (inc >= 38) shellKey = '43';
    else shellKey = '33';

    let arr = shells.get(shellKey);
    if (!arr) { arr = []; shells.set(shellKey, arr); }
    arr.push(i);
  }

  // Temporary neighbor list per satellite (max 4)
  // Only allocate for ISL-capable satellites (#6 minor: sparse allocation)
  const tempNeighbors: Map<number, number[]> = new Map();

  for (const [, shellSats] of shells) {
    if (shellSats.length < 2) continue;

    // Ensure all shell sats have a neighbor list
    for (const idx of shellSats) {
      if (!tempNeighbors.has(idx)) tempNeighbors.set(idx, []);
    }

    // Cluster into orbital planes by RAAN (gap < 3° from previous element) (#2b fix)
    const sorted = shellSats.slice().sort((a, b) => raans[a] - raans[b]);
    const planes: PlaneGroup[] = [];
    let currentPlane: PlaneGroup = { planeRaan: raans[sorted[0]], indices: [sorted[0]] };

    for (let j = 1; j < sorted.length; j++) {
      const idx = sorted[j];
      // Compare against previous element's RAAN, not cluster origin (#2b)
      if (raans[idx] - raans[sorted[j - 1]] > 3) {
        planes.push(currentPlane);
        currentPlane = { planeRaan: raans[idx], indices: [idx] };
      } else {
        currentPlane.indices.push(idx);
      }
    }
    planes.push(currentPlane);

    // Handle wrap-around: if first and last plane are within 3° (mod 360)
    if (planes.length > 1) {
      const first = planes[0];
      const last = planes[planes.length - 1];
      if ((360 - raans[last.indices[last.indices.length - 1]] + raans[first.indices[0]]) <= 3) {
        last.indices.push(...first.indices);
        planes.shift();
      }
    }

    // Compute mean inclination for this shell (for orbital frame projection)
    let sumInc = 0;
    for (const idx of shellSats) sumInc += inclinations[idx];
    const meanIncRad = (sumInc / shellSats.length) * DEG_TO_RAD;

    // In-plane links: sort by argument of latitude, link forward/backward (#1 fix)
    for (const plane of planes) {
      if (plane.indices.length < 2) continue;

      // Use mean RAAN for this plane
      let planeRaanSum = 0;
      for (const idx of plane.indices) planeRaanSum += raans[idx];
      const planeRaanRad = (planeRaanSum / plane.indices.length) * DEG_TO_RAD;

      // Sort by argument of latitude — the angle within the orbital plane
      plane.indices.sort((a, b) => {
        const pa = a * 3, pb = b * 3;
        const angA = argumentOfLatitude(positions[pa], positions[pa + 1], positions[pa + 2], planeRaanRad, meanIncRad);
        const angB = argumentOfLatitude(positions[pb], positions[pb + 1], positions[pb + 2], planeRaanRad, meanIncRad);
        return angA - angB;
      });

      const pIndices = plane.indices;
      for (let k = 0; k < pIndices.length; k++) {
        const curr = pIndices[k];
        const next = pIndices[(k + 1) % pIndices.length];

        // Check distance constraint
        const pc = curr * 3, pn = next * 3;
        const dx = positions[pn] - positions[pc];
        const dy = positions[pn + 1] - positions[pc + 1];
        const dz = positions[pn + 2] - positions[pc + 2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= ISL_MAX_RANGE_SQ) {
          addEdge(tempNeighbors, curr, next);
        }
      }
    }

    // Cross-plane links: link multiple pairs along adjacent planes (#2 fix)
    for (let p = 0; p < planes.length; p++) {
      const nextP = (p + 1) % planes.length;
      linkCrossPlane(positions, tempNeighbors, planes[p].indices, planes[nextP].indices);
    }
  }

  // Pack into CSR format
  const neighborOffsets = new Uint32Array(count + 1);
  let totalEdges = 0;
  for (let i = 0; i < count; i++) {
    const n = tempNeighbors.get(i);
    if (n) totalEdges += n.length;
  }

  const neighborIndices = new Uint32Array(totalEdges); // #6: Uint32 for future growth
  let offset = 0;
  for (let i = 0; i < count; i++) {
    neighborOffsets[i] = offset;
    const neighbors = tempNeighbors.get(i);
    if (neighbors) {
      for (let j = 0; j < neighbors.length; j++) {
        neighborIndices[offset++] = neighbors[j];
      }
    }
  }
  neighborOffsets[count] = offset;

  cachedGraph = {
    neighborOffsets,
    neighborIndices,
    timestamp: Date.now(),
  };

  return cachedGraph;
}

/**
 * Atomically add an undirected edge between two satellites.
 * Returns true if both directions were added, false if either side
 * lacks terminal capacity or the edge already exists.
 */
function addEdge(tempNeighbors: Map<number, number[]>, a: number, b: number): boolean {
  let aN = tempNeighbors.get(a);
  let bN = tempNeighbors.get(b);
  if (!aN) { aN = []; tempNeighbors.set(a, aN); }
  if (!bN) { bN = []; tempNeighbors.set(b, bN); }
  if (aN.length >= 4 || bN.length >= 4) return false;
  if (aN.indexOf(b) !== -1) return false; // already linked
  aN.push(b);
  bN.push(a);
  return true;
}

/**
 * Link multiple cross-plane pairs between two adjacent planes (#2 fix).
 *
 * For each satellite in planeA, find the nearest satellite in planeB
 * that is within ISL range and both have available terminals. This produces
 * roughly one cross-plane link per ~20 satellites rather than one per plane.
 */
function linkCrossPlane(
  positions: Float32Array,
  tempNeighbors: Map<number, number[]>,
  planeA: number[],
  planeB: number[],
): void {
  // Every satellite attempts a cross-plane link. The 4-terminal cap in addEdge
  // ensures we never exceed physical reality (2 in-plane + 2 cross-plane).
  // The old step=planeLength/20 left ~67% of satellites with no cross-plane
  // links, causing BFS disconnects over remote ocean locations like Point Nemo.
  for (let i = 0; i < planeA.length; i++) {
    const a = planeA[i];
    const pa = a * 3;
    const ax = positions[pa], ay = positions[pa + 1], az = positions[pa + 2];

    // Skip satellites near the poles — orbital planes converge and the
    // relative angular rate exceeds laser terminal gimbal tracking limits.
    const aR = Math.sqrt(ax * ax + ay * ay + az * az);
    if (aR > 0 && Math.abs(ay / aR) > POLAR_EXCLUSION_SIN) continue;

    // Check if this satellite still has terminal capacity
    const aN = tempNeighbors.get(a);
    if (aN && aN.length >= 4) continue;

    let bestDistSq = ISL_MAX_RANGE_SQ;
    let bestB = -1;

    for (const b of planeB) {
      const bN = tempNeighbors.get(b);
      if (bN && bN.length >= 4) continue;

      const pb = b * 3;
      const bx = positions[pb], by = positions[pb + 1], bz = positions[pb + 2];

      // Skip polar candidates on the B side too
      const bR = Math.sqrt(bx * bx + by * by + bz * bz);
      if (bR > 0 && Math.abs(by / bR) > POLAR_EXCLUSION_SIN) continue;

      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestDistSq) {
        bestDistSq = d;
        bestB = b;
      }
    }

    if (bestB >= 0) {
      addEdge(tempNeighbors, a, bestB);
    }
  }
}
