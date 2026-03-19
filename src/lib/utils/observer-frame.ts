import { geodeticToCartesian } from './coordinates';

const DEG_TO_RAD = Math.PI / 180;

export interface ObserverFrame {
  pos: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  east: { x: number; y: number; z: number };
  north: { x: number; y: number; z: number };
}

/** Compute an ENU observer frame for any lat/lon on the unit globe. */
export function computeObserverFrame(latDeg: number, lonDeg: number): ObserverFrame {
  const p = geodeticToCartesian(latDeg * DEG_TO_RAD, lonDeg * DEG_TO_RAD, 0, 1);
  const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);

  const normal = { x: p.x / len, y: p.y / len, z: p.z / len };

  // East = cross(Y_up, normal), normalized
  // Y_up = (0, 1, 0)
  // At the poles, normal aligns with Y_up and the cross product degenerates.
  // Fall back to X-axis as east at the north pole, -X at the south pole.
  let rawEast = {
    x: 1 * normal.z - 0,
    y: 0,
    z: 0 - 1 * normal.x,
  };
  let eLen = Math.sqrt(rawEast.x * rawEast.x + rawEast.y * rawEast.y + rawEast.z * rawEast.z);
  if (eLen < 1e-10) {
    // Pole: use X-axis as east (north pole) or -X (south pole)
    rawEast = { x: normal.y > 0 ? 1 : -1, y: 0, z: 0 };
    eLen = 1;
  }
  const east = { x: rawEast.x / eLen, y: rawEast.y / eLen, z: rawEast.z / eLen };

  // North = cross(normal, east)
  const north = {
    x: normal.y * east.z - normal.z * east.y,
    y: normal.z * east.x - normal.x * east.z,
    z: normal.x * east.y - normal.y * east.x,
  };

  return { pos: p, normal, east, north };
}

/** Compute azimuth and elevation (degrees) from observer to a 3D point. */
export function computeAzElFrom(
  observer: ObserverFrame,
  x: number, y: number, z: number
): { az: number; el: number } {
  const dx = x - observer.pos.x;
  const dy = y - observer.pos.y;
  const dz = z - observer.pos.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-10) return { az: 0, el: 0 };

  const dirX = dx / len;
  const dirY = dy / len;
  const dirZ = dz / len;

  const sinEl = dirX * observer.normal.x + dirY * observer.normal.y + dirZ * observer.normal.z;
  const el = (Math.asin(Math.max(-1, Math.min(1, sinEl))) * 180) / Math.PI;

  // Horizontal component
  const hx = dirX - sinEl * observer.normal.x;
  const hy = dirY - sinEl * observer.normal.y;
  const hz = dirZ - sinEl * observer.normal.z;

  const eastDot = hx * observer.east.x + hy * observer.east.y + hz * observer.east.z;
  const northDot = hx * observer.north.x + hy * observer.north.y + hz * observer.north.z;
  let az = (Math.atan2(eastDot, northDot) * 180) / Math.PI;
  if (az < 0) az += 360;

  return { az, el };
}

/** Convert az/el (degrees) to a 3D direction vector in the observer's frame. */
export function azElToDirection3D(
  observer: ObserverFrame,
  azDeg: number, elDeg: number
): { x: number; y: number; z: number } {
  const az = azDeg * DEG_TO_RAD;
  const el = elDeg * DEG_TO_RAD;
  const cosEl = Math.cos(el);
  const sinEl = Math.sin(el);
  const sinAz = Math.sin(az);
  const cosAz = Math.cos(az);

  return {
    x: sinAz * cosEl * observer.east.x + cosAz * cosEl * observer.north.x + sinEl * observer.normal.x,
    y: sinAz * cosEl * observer.east.y + cosAz * cosEl * observer.north.y + sinEl * observer.normal.y,
    z: sinAz * cosEl * observer.east.z + cosAz * cosEl * observer.north.z + sinEl * observer.normal.z,
  };
}
