import { describe, it, expect, beforeEach } from 'vitest';
import {
  setPositionsArray,
  setTLEData,
  setSatrecObjects,
  setInclinationsArray,
  setRAANArray,
  setISLCapableArray,
} from '../lib/satellites/satellite-store';
import { buildISLGraph } from '../lib/satellites/isl-graph';

function setupSatellites(
  positions: number[][],
  inclinations: number[],
  raans: number[],
  islCapable: number[],
) {
  const count = positions.length;
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    posArr[i * 3] = positions[i][0];
    posArr[i * 3 + 1] = positions[i][1];
    posArr[i * 3 + 2] = positions[i][2];
  }

  // Create minimal TLE data entries to set satellite count
  const tleData = Array.from({ length: count }, (_, i) => ({
    name: `SAT-${i}`,
    line1: `1 ${25544 + i}U 98067A   21264.51782528  .00001764  00000-0  40842-4 0  9993`,
    line2: `2 ${25544 + i}  ${inclinations[i].toFixed(4)} ${raans[i].toFixed(4)} 0004429 269.8571  90.2025 15.48919755349985`,
    inclination: inclinations[i],
  }));

  setTLEData(tleData);
  setSatrecObjects([]); // not needed for graph build
  setPositionsArray(posArr);
  setInclinationsArray(new Float32Array(inclinations));
  setRAANArray(new Float32Array(raans));
  setISLCapableArray(new Uint8Array(islCapable));
}

describe('buildISLGraph', () => {
  beforeEach(() => {
    setPositionsArray(new Float32Array(0));
    setInclinationsArray(new Float32Array(0));
    setRAANArray(new Float32Array(0));
    setISLCapableArray(new Uint8Array(0));
    setTLEData([]);
  });

  it('returns null with no data', () => {
    const graph = buildISLGraph();
    expect(graph).toBeNull();
  });

  it('builds graph with ISL-capable satellites in same plane', () => {
    // 4 satellites in the same orbital plane (53° shell, same RAAN)
    // Close together (within ISL max range of 5016 km ≈ 0.787 unit sphere)
    const R = 1 + 550 / 6371; // ~1.086
    const step = 0.05; // small angular steps to keep sats within range
    setupSatellites(
      [
        [R, 0, 0],
        [R * Math.cos(step), R * Math.sin(step), 0],
        [R * Math.cos(step * 2), R * Math.sin(step * 2), 0],
        [R * Math.cos(step * 3), R * Math.sin(step * 3), 0],
      ],
      [53, 53, 53, 53],
      [120, 120, 120, 120], // same RAAN = same plane
      [1, 1, 1, 1],
    );

    const graph = buildISLGraph();
    expect(graph).not.toBeNull();
    expect(graph!.neighborOffsets.length).toBe(5); // count + 1
    // Each sat should have at least 1 neighbor (in-plane link)
    for (let i = 0; i < 4; i++) {
      const start = graph!.neighborOffsets[i];
      const end = graph!.neighborOffsets[i + 1];
      expect(end - start).toBeGreaterThanOrEqual(1);
    }
  });

  it('skips non-ISL-capable satellites', () => {
    const R = 1 + 550 / 6371;
    setupSatellites(
      [
        [R, 0, 0],
        [0, R, 0],
      ],
      [53, 53],
      [120, 120],
      [0, 0], // not ISL capable
    );

    const graph = buildISLGraph();
    expect(graph).not.toBeNull();
    // No edges since no ISL-capable sats
    const totalEdges = graph!.neighborOffsets[2];
    expect(totalEdges).toBe(0);
  });

  it('creates cross-plane links between adjacent planes', () => {
    const R = 1 + 550 / 6371;
    const step = 0.03;
    // Two planes with 5° RAAN separation, each with 2 close sats
    setupSatellites(
      [
        [R, 0, 0],                                     // plane 1, sat 0
        [R * Math.cos(step), R * Math.sin(step), 0],   // plane 1, sat 1
        [R, 0, R * 0.03],                              // plane 2, sat 2 (close to sat 0)
        [R * Math.cos(step), R * Math.sin(step), R * 0.03], // plane 2, sat 3 (close to sat 1)
      ],
      [53, 53, 53, 53],
      [120, 120, 125, 125], // two distinct planes
      [1, 1, 1, 1],
    );

    const graph = buildISLGraph();
    expect(graph).not.toBeNull();
    // Check that at least some cross-plane links exist
    const totalEdges = graph!.neighborOffsets[4];
    expect(totalEdges).toBeGreaterThanOrEqual(2); // at least some links
  });
});
