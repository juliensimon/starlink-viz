/**
 * Dish local reference frame (normal, east, north vectors).
 * Shared between ConnectionBeam and Satellites for cone filtering.
 */

import { geodeticToCartesian } from './coordinates';
import { DISH_LAT_DEG, DISH_LON_DEG } from '../config';

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const _dp = geodeticToCartesian(degToRad(DISH_LAT_DEG), degToRad(DISH_LON_DEG), 0, 1);

/** Dish 3D position on the unit globe */
export const DISH_POS = { x: _dp.x, y: _dp.y, z: _dp.z };

const _len = Math.sqrt(DISH_POS.x ** 2 + DISH_POS.y ** 2 + DISH_POS.z ** 2);

/** Dish surface normal (normalized position) */
export const DISH_NORMAL = {
  x: DISH_POS.x / _len,
  y: DISH_POS.y / _len,
  z: DISH_POS.z / _len,
};

// East = cross(up, normal) where up = (0, 1, 0)
const _rawEast = {
  x: 1 * DISH_NORMAL.z - 0 * DISH_NORMAL.y,
  y: 0 * DISH_NORMAL.x - 0 * DISH_NORMAL.z,
  z: 0 * DISH_NORMAL.y - 1 * DISH_NORMAL.x,
};
const _eLen = Math.sqrt(_rawEast.x ** 2 + _rawEast.y ** 2 + _rawEast.z ** 2);

/** East direction in dish local frame */
export const DISH_EAST = {
  x: _rawEast.x / _eLen,
  y: _rawEast.y / _eLen,
  z: _rawEast.z / _eLen,
};

/** North direction in dish local frame = cross(normal, east) */
export const DISH_NORTH = {
  x: DISH_NORMAL.y * DISH_EAST.z - DISH_NORMAL.z * DISH_EAST.y,
  y: DISH_NORMAL.z * DISH_EAST.x - DISH_NORMAL.x * DISH_EAST.z,
  z: DISH_NORMAL.x * DISH_EAST.y - DISH_NORMAL.y * DISH_EAST.x,
};

/**
 * Convert azimuth/elevation (degrees) to a 3D direction vector
 * in the dish's local reference frame.
 */
export function azElToDirection(azDeg: number, elDeg: number): { x: number; y: number; z: number } {
  const az = degToRad(azDeg);
  const el = degToRad(elDeg);
  const cosEl = Math.cos(el);
  const sinEl = Math.sin(el);
  const sinAz = Math.sin(az);
  const cosAz = Math.cos(az);

  return {
    x: sinAz * cosEl * DISH_EAST.x + cosAz * cosEl * DISH_NORTH.x + sinEl * DISH_NORMAL.x,
    y: sinAz * cosEl * DISH_EAST.y + cosAz * cosEl * DISH_NORTH.y + sinEl * DISH_NORMAL.y,
    z: sinAz * cosEl * DISH_EAST.z + cosAz * cosEl * DISH_NORTH.z + sinEl * DISH_NORMAL.z,
  };
}

/**
 * Compute azimuth and elevation (degrees) from dish to a 3D point.
 */
export function computeAzEl(x: number, y: number, z: number): { az: number; el: number } {
  const dx = x - DISH_POS.x;
  const dy = y - DISH_POS.y;
  const dz = z - DISH_POS.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-10) return { az: 0, el: 0 };

  const dirX = dx / len;
  const dirY = dy / len;
  const dirZ = dz / len;

  const sinEl = dirX * DISH_NORMAL.x + dirY * DISH_NORMAL.y + dirZ * DISH_NORMAL.z;
  const el = (Math.asin(Math.max(-1, Math.min(1, sinEl))) * 180) / Math.PI;

  const hx = dirX - sinEl * DISH_NORMAL.x;
  const hy = dirY - sinEl * DISH_NORMAL.y;
  const hz = dirZ - sinEl * DISH_NORMAL.z;

  const eastDot = hx * DISH_EAST.x + hy * DISH_EAST.y + hz * DISH_EAST.z;
  const northDot = hx * DISH_NORTH.x + hy * DISH_NORTH.y + hz * DISH_NORTH.z;
  let az = (Math.atan2(eastDot, northDot) * 180) / Math.PI;
  if (az < 0) az += 360;

  return { az, el };
}
