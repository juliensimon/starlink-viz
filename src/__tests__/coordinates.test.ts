import { describe, it, expect } from 'vitest';
import { geodeticToCartesian, eciToGeodetic, angularDeltaDeg, haversineKm } from '../lib/utils/coordinates';
import { EARTH_RADIUS_KM } from '../lib/config';

const degToRad = (d: number) => (d * Math.PI) / 180;

describe('geodeticToCartesian', () => {
  it('places equator/prime meridian on +X axis', () => {
    const { x, y, z } = geodeticToCartesian(0, 0, 0, 1);
    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('places north pole on +Y axis', () => {
    const { x, y, z } = geodeticToCartesian(Math.PI / 2, 0, 0, 1);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(1, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('negates Z for Three.js UV alignment (east longitude = -Z)', () => {
    const { z } = geodeticToCartesian(0, Math.PI / 2, 0, 1); // 90°E
    expect(z).toBeCloseTo(-1, 5); // Negated
  });

  it('scales altitude correctly (550km LEO)', () => {
    const { x, y, z } = geodeticToCartesian(0, 0, 550, 1);
    const dist = Math.sqrt(x * x + y * y + z * z);
    expect(dist).toBeCloseTo(1 + 550 / 6371, 4);
  });

  it('places Paris at correct position', () => {
    const { x, y, z } = geodeticToCartesian(degToRad(48.86), degToRad(2.35), 0, 1);
    const dist = Math.sqrt(x * x + y * y + z * z);
    expect(dist).toBeCloseTo(1, 4);
    expect(y).toBeGreaterThan(0.7); // Northern hemisphere
    expect(x).toBeGreaterThan(0); // Near prime meridian
  });
});

describe('eciToGeodetic', () => {
  it('converts position on +X axis to equator/prime meridian', () => {
    // Use WGS84 semi-major axis (6378.137 km), not mean radius
    const result = eciToGeodetic({ x: 6378.137, y: 0, z: 0 }, 0);
    expect(result.latitude).toBeCloseTo(0, 2);
    expect(result.longitude).toBeCloseTo(0, 2);
    expect(result.height).toBeCloseTo(0, 0);
  });

  it('converts position on +Z axis to equator/90°E with gmst=0', () => {
    const result = eciToGeodetic({ x: 0, y: 0, z: 6371 }, 0);
    expect(result.latitude).toBeCloseTo(Math.PI / 2, 1); // North pole in ECI Z
  });

  it('returns positive height for satellite altitude', () => {
    const result = eciToGeodetic({ x: 6921, y: 0, z: 0 }, 0); // 6371 + 550
    expect(result.height).toBeGreaterThan(500);
    expect(result.height).toBeLessThan(600);
  });
});

describe('angularDeltaDeg', () => {
  it('returns plain difference for nearby angles', () => {
    expect(angularDeltaDeg(120, 130)).toBeCloseTo(10);
    expect(angularDeltaDeg(130, 120)).toBeCloseTo(10);
  });

  it('wraps around 0°/360° — a north-crossing dish is NOT a handoff', () => {
    // Bug history: server.ts used Math.abs(a - b), so 359.4° → 0.6° gave a
    // delta of 358.8° and broadcast a spurious satellite handoff.
    expect(angularDeltaDeg(359.4, 0.6)).toBeCloseTo(1.2, 5);
    expect(angularDeltaDeg(0.6, 359.4)).toBeCloseTo(1.2, 5);
  });

  it('handles the ±180 convention too', () => {
    expect(angularDeltaDeg(-179, 179)).toBeCloseTo(2);
  });

  it('maximum possible delta is 180°', () => {
    expect(angularDeltaDeg(0, 180)).toBeCloseTo(180);
    expect(angularDeltaDeg(90, 271)).toBeCloseTo(179);
  });
});

describe('haversineKm (shared)', () => {
  it('matches known distance Paris→London (~340km)', () => {
    const d = haversineKm(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(350);
  });

  it('returns 0 for identical points', () => {
    expect(haversineKm(10, 20, 10, 20)).toBe(0);
  });

  it('uses the configured Earth radius (half-circumference for antipodes)', () => {
    expect(haversineKm(0, 0, 0, 180)).toBeCloseTo(Math.PI * EARTH_RADIUS_KM, 0);
  });
});
