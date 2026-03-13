/**
 * SGP4 orbital propagation using satellite.js.
 * Propagates satellite positions from TLE data.
 */

import * as satellite from 'satellite.js';
import type { TLEData } from './tle-fetcher';

export type SatRec = ReturnType<typeof satellite.twoline2satrec>;

/**
 * Initialize satellite records from TLE data.
 * Returns array of satrec objects (some may be invalid).
 */
export function initSatelliteRecords(tleData: TLEData[]): SatRec[] {
  return tleData.map((tle) => satellite.twoline2satrec(tle.line1, tle.line2));
}

/**
 * Propagate a batch of satellites and write positions to a Float32Array.
 *
 * @param satrecs Array of all satrec objects
 * @param date Date to propagate to
 * @param startIdx Start index in satrecs array
 * @param count Number of satellites to propagate in this batch
 * @param output Float32Array to write positions into (3 floats per satellite, indexed from startIdx * 3)
 */
export function propagateBatch(
  satrecs: SatRec[],
  date: Date,
  startIdx: number,
  count: number,
  output: Float32Array
): void {
  const gmst = satellite.gstime(date);
  const end = Math.min(startIdx + count, satrecs.length);

  for (let i = startIdx; i < end; i++) {
    const satrec = satrecs[i];
    const outIdx = i * 3;

    try {
      const positionAndVelocity = satellite.propagate(satrec, date);
      if (!positionAndVelocity) {
        output[outIdx] = 0;
        output[outIdx + 1] = 0;
        output[outIdx + 2] = 0;
        continue;
      }
      const positionEci = positionAndVelocity.position;

      // propagate returns false on error
      if (
        !positionEci ||
        typeof positionEci === 'boolean'
      ) {
        // Mark as invalid — place at origin (will be hidden by scale 0)
        output[outIdx] = 0;
        output[outIdx + 1] = 0;
        output[outIdx + 2] = 0;
        continue;
      }

      const positionGd = satellite.eciToGeodetic(
        positionEci as satellite.EciVec3<number>,
        gmst
      );

      // Convert geodetic to cartesian on unit sphere
      const lat = positionGd.latitude; // radians
      const lon = positionGd.longitude; // radians
      const alt = positionGd.height; // km

      // Compressed scale: real LEO ~550km, Earth ~6371km radius
      const radius = 1 + (alt / 6371) * 0.15;

      output[outIdx] = radius * Math.cos(lat) * Math.cos(lon);
      output[outIdx + 1] = radius * Math.sin(lat);
      output[outIdx + 2] = radius * Math.cos(lat) * Math.sin(lon);
    } catch {
      // Propagation failed — place at origin
      output[outIdx] = 0;
      output[outIdx + 1] = 0;
      output[outIdx + 2] = 0;
    }
  }
}
