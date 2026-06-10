/**
 * Dish local reference frame (normal, east, north vectors).
 * Shared between ConnectionBeam and Satellites for cone filtering.
 *
 * Thin wrapper around the generic observer frame in observer-frame.ts with
 * the configured dish lat/lon baked in — one implementation of the ENU
 * az/el math (including the pole-degeneracy fallback), two entry points.
 */

import { DISH_LAT_DEG, DISH_LON_DEG } from '../config';
import {
  computeObserverFrame,
  computeAzElFrom,
  azElToDirection3D,
} from './observer-frame';

const DISH_FRAME = computeObserverFrame(DISH_LAT_DEG, DISH_LON_DEG);

/** Dish 3D position on the unit globe */
export const DISH_POS = DISH_FRAME.pos;

/** Dish surface normal (normalized position) */
export const DISH_NORMAL = DISH_FRAME.normal;

/** East direction in dish local frame */
export const DISH_EAST = DISH_FRAME.east;

/** North direction in dish local frame = cross(normal, east) */
export const DISH_NORTH = DISH_FRAME.north;

/**
 * Convert azimuth/elevation (degrees) to a 3D direction vector
 * in the dish's local reference frame.
 */
export function azElToDirection(azDeg: number, elDeg: number): { x: number; y: number; z: number } {
  return azElToDirection3D(DISH_FRAME, azDeg, elDeg);
}

/**
 * Compute azimuth and elevation (degrees) from dish to a 3D point.
 */
export function computeAzEl(x: number, y: number, z: number): { az: number; el: number } {
  return computeAzElFrom(DISH_FRAME, x, y, z);
}
