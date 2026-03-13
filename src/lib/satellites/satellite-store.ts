/**
 * In-memory satellite catalog.
 * Stores TLE data and satrec objects for satellite propagation.
 */

import type { TLEData } from './tle-fetcher';
import type { SatRec } from './propagator';

let tleData: TLEData[] = [];
let satrecObjects: SatRec[] = [];
let connectedIndex: number | null = null;
let positionsArray: Float32Array | null = null;

/** Set the TLE data catalog */
export function setTLEData(data: TLEData[]): void {
  tleData = data;
}

/** Set the satrec objects */
export function setSatrecObjects(satrecs: SatRec[]): void {
  satrecObjects = satrecs;
}

/** Get the total number of satellites */
export function getSatelliteCount(): number {
  return tleData.length;
}

/** Get a satellite name by index */
export function getSatelliteName(index: number): string {
  return tleData[index]?.name ?? 'Unknown';
}

/** Get the satrec objects */
export function getSatrecs(): SatRec[] {
  return satrecObjects;
}

/** Set which satellite is "connected" */
export function setConnectedIndex(index: number | null): void {
  connectedIndex = index;
}

/** Get the connected satellite index */
export function getConnectedIndex(): number | null {
  return connectedIndex;
}

/** Set the shared satellite positions Float32Array */
export function setPositionsArray(positions: Float32Array): void {
  positionsArray = positions;
}

/** Get the shared satellite positions Float32Array */
export function getPositionsArray(): Float32Array | null {
  return positionsArray;
}
