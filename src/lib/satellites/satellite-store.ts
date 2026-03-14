/**
 * In-memory satellite catalog.
 * Stores TLE data and satrec objects for satellite propagation.
 */

import type { TLEData } from './tle-fetcher';
import type { SatRec, SatelliteOrbitalData } from './propagator';

let tleData: TLEData[] = [];
let satrecObjects: SatRec[] = [];
let connectedIndex: number | null = null;
let positionsArray: Float32Array | null = null;
let connectedOrbitalData: SatelliteOrbitalData | null = null;
let connectedGroundStation: string | null = null;
let inclinationsArray: Float32Array | null = null;

// Full (unfiltered) catalog — used for shell stats regardless of altitude filter toggle
let fullCatalogCount = 0;
let fullCatalogInclinations: Float32Array | null = null;
let fullCatalogAltitudes: Float32Array | null = null;

/** Set the TLE data catalog */
export function setTLEData(data: TLEData[]): void {
  tleData = data;
}

/** Set the satrec objects */
export function setSatrecObjects(satrecs: SatRec[]): void {
  satrecObjects = satrecs;
}

/** Get the full TLE data catalog */
export function getTLEData(): TLEData[] {
  return tleData;
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

/** Set orbital data for the connected satellite */
export function setConnectedOrbitalData(data: SatelliteOrbitalData | null): void {
  connectedOrbitalData = data;
}

/** Get orbital data for the connected satellite */
export function getConnectedOrbitalData(): SatelliteOrbitalData | null {
  return connectedOrbitalData;
}

/** Set connected ground station name */
export function setConnectedGroundStation(name: string | null): void {
  connectedGroundStation = name;
}

/** Get connected ground station name */
export function getConnectedGroundStation(): string | null {
  return connectedGroundStation;
}

/** Set the inclinations array */
export function setInclinationsArray(inclinations: Float32Array): void {
  inclinationsArray = inclinations;
}

/** Get the inclinations array */
export function getInclinationsArray(): Float32Array | null {
  return inclinationsArray;
}

/** Store the full unfiltered catalog snapshot for shell statistics */
export function setFullCatalog(count: number, inclinations: Float32Array, altitudes: Float32Array): void {
  fullCatalogCount = count;
  fullCatalogInclinations = inclinations;
  fullCatalogAltitudes = altitudes;
}

/** Get full catalog data for shell statistics */
export function getFullCatalog(): { count: number; inclinations: Float32Array | null; altitudes: Float32Array | null } {
  return { count: fullCatalogCount, inclinations: fullCatalogInclinations, altitudes: fullCatalogAltitudes };
}

/** Get NORAD catalog ID from TLE line 1 */
export function getNoradId(index: number): string {
  const tle = tleData[index];
  if (!tle) return '---';
  return tle.line1.substring(2, 7).trim();
}

/** Parse international designator from TLE line 1 (columns 9-16) → { year, launch, piece } */
export function getLaunchInfo(index: number): { year: number; launch: string } | null {
  const tle = tleData[index];
  if (!tle) return null;
  const intlDesig = tle.line1.substring(9, 17).trim();
  if (!intlDesig) return null;
  const yy = parseInt(intlDesig.substring(0, 2), 10);
  const year = yy >= 57 ? 1900 + yy : 2000 + yy; // NORAD convention: 57-99 = 1957-1999, 00-56 = 2000-2056
  const launch = intlDesig.substring(2, 5).trim();
  return { year, launch };
}
