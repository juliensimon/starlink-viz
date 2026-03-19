import { describe, it, expect } from 'vitest';
import { computeObserverFrame, computeAzElFrom, azElToDirection3D } from '@/lib/utils/observer-frame';

describe('computeObserverFrame', () => {
  it('returns orthonormal basis vectors', () => {
    const frame = computeObserverFrame(48.91, 1.91);
    const { normal, east, north } = frame;

    // Each vector should be unit length
    const nLen = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
    const eLen = Math.sqrt(east.x ** 2 + east.y ** 2 + east.z ** 2);
    const northLen = Math.sqrt(north.x ** 2 + north.y ** 2 + north.z ** 2);
    expect(nLen).toBeCloseTo(1, 10);
    expect(eLen).toBeCloseTo(1, 10);
    expect(northLen).toBeCloseTo(1, 10);

    // Orthogonal: dot products should be ~0
    const ne = normal.x * east.x + normal.y * east.y + normal.z * east.z;
    const nn = normal.x * north.x + normal.y * north.y + normal.z * north.z;
    const en = east.x * north.x + east.y * north.y + east.z * north.z;
    expect(ne).toBeCloseTo(0, 10);
    expect(nn).toBeCloseTo(0, 10);
    expect(en).toBeCloseTo(0, 10);
  });

  it('normal points outward from the globe', () => {
    const frame = computeObserverFrame(0, 0);
    // At lat=0, lon=0, the point on unit sphere should be (1, 0, 0)
    // (X = cos(lat)*cos(lon) = 1, Y = sin(lat) = 0, Z = -cos(lat)*sin(lon) = 0)
    expect(frame.pos.x).toBeCloseTo(1, 5);
    expect(frame.pos.y).toBeCloseTo(0, 5);
    expect(frame.pos.z).toBeCloseTo(0, 5);
    expect(frame.normal.x).toBeCloseTo(1, 5);
  });

  it('north vector has positive Y component in northern hemisphere', () => {
    const frame = computeObserverFrame(45, 0);
    // North should point "up" in the northward direction
    // For a point at 45°N, north direction should have a significant Y component
    expect(frame.north.y).toBeGreaterThan(0);
  });
});

describe('computeAzElFrom', () => {
  it('zenith is at elevation 90', () => {
    const frame = computeObserverFrame(0, 0);
    // A point directly above the observer (along the normal)
    const above = {
      x: frame.pos.x + frame.normal.x * 0.5,
      y: frame.pos.y + frame.normal.y * 0.5,
      z: frame.pos.z + frame.normal.z * 0.5,
    };
    const { el } = computeAzElFrom(frame, above.x, above.y, above.z);
    expect(el).toBeCloseTo(90, 1);
  });

  it('horizon is at elevation 0', () => {
    const frame = computeObserverFrame(0, 0);
    // A point along the east direction (on the horizon)
    const horizon = {
      x: frame.pos.x + frame.east.x * 0.5,
      y: frame.pos.y + frame.east.y * 0.5,
      z: frame.pos.z + frame.east.z * 0.5,
    };
    const { az, el } = computeAzElFrom(frame, horizon.x, horizon.y, horizon.z);
    expect(el).toBeCloseTo(0, 1);
    expect(az).toBeCloseTo(90, 1); // East = 90°
  });

  it('north direction has azimuth 0', () => {
    const frame = computeObserverFrame(45, 0);
    const north = {
      x: frame.pos.x + frame.north.x * 0.5,
      y: frame.pos.y + frame.north.y * 0.5,
      z: frame.pos.z + frame.north.z * 0.5,
    };
    const { az, el } = computeAzElFrom(frame, north.x, north.y, north.z);
    expect(az).toBeCloseTo(0, 1);
    expect(el).toBeCloseTo(0, 1);
  });
});

describe('azElToDirection3D', () => {
  it('zenith direction aligns with normal', () => {
    const frame = computeObserverFrame(48.91, 1.91);
    const dir = azElToDirection3D(frame, 0, 90);
    expect(dir.x).toBeCloseTo(frame.normal.x, 5);
    expect(dir.y).toBeCloseTo(frame.normal.y, 5);
    expect(dir.z).toBeCloseTo(frame.normal.z, 5);
  });

  it('roundtrips through computeAzElFrom', () => {
    const frame = computeObserverFrame(35, -120);
    const az = 135, el = 45;
    const dir = azElToDirection3D(frame, az, el);
    // Place a point at that direction
    const pt = {
      x: frame.pos.x + dir.x * 2,
      y: frame.pos.y + dir.y * 2,
      z: frame.pos.z + dir.z * 2,
    };
    const result = computeAzElFrom(frame, pt.x, pt.y, pt.z);
    expect(result.az).toBeCloseTo(az, 3);
    expect(result.el).toBeCloseTo(el, 3);
  });
});
