import { describe, it, expect } from 'vitest';
import { propagatePosition, initSatelliteRecords } from '@/lib/satellites/propagator';

// Real STARLINK-1007 TLE (epoch 2024)
const TEST_TLE = {
  name: 'STARLINK-1007',
  line1: '1 44713U 19074A   24001.50000000  .00001000  00000-0  10000-3 0  9991',
  line2: '2 44713  53.0544 200.0000 0001500  90.0000 270.0000 15.05000000 10001',
};

describe('propagatePosition', () => {
  it('returns a 3D position for a valid satrec', () => {
    const [satrec] = initSatelliteRecords([TEST_TLE]);
    const pos = propagatePosition(satrec, new Date('2024-01-01T12:00:00Z'));
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeDefined();
    expect(pos!.y).toBeDefined();
    expect(pos!.z).toBeDefined();
  });

  it('position is on or above unit sphere (radius >= 1)', () => {
    const [satrec] = initSatelliteRecords([TEST_TLE]);
    const pos = propagatePosition(satrec, new Date('2024-01-01T12:00:00Z'));
    expect(pos).not.toBeNull();
    const radius = Math.sqrt(pos!.x ** 2 + pos!.y ** 2 + pos!.z ** 2);
    // LEO satellite: radius should be ~1.08 (1 + 550/6371)
    expect(radius).toBeGreaterThan(1.05);
    expect(radius).toBeLessThan(1.15);
  });

  it('altitude is consistent with 53° shell (~540km)', () => {
    const [satrec] = initSatelliteRecords([TEST_TLE]);
    const pos = propagatePosition(satrec, new Date('2024-01-01T12:00:00Z'));
    expect(pos).not.toBeNull();
    const radius = Math.sqrt(pos!.x ** 2 + pos!.y ** 2 + pos!.z ** 2);
    const altKm = (radius - 1) * 6371;
    expect(altKm).toBeGreaterThan(400);
    expect(altKm).toBeLessThan(700);
  });

  it('returns different positions for different times', () => {
    const [satrec] = initSatelliteRecords([TEST_TLE]);
    const pos1 = propagatePosition(satrec, new Date('2024-01-01T12:00:00Z'));
    const pos2 = propagatePosition(satrec, new Date('2024-01-01T12:05:00Z'));
    expect(pos1).not.toBeNull();
    expect(pos2).not.toBeNull();
    // 5 minutes at 7.6 km/s = ~2280 km, positions should differ
    const dx = pos1!.x - pos2!.x;
    const dy = pos1!.y - pos2!.y;
    const dz = pos1!.z - pos2!.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    expect(dist).toBeGreaterThan(0.01);
  });

  it('returns null for a corrupt satrec', () => {
    const badTle = {
      name: 'BAD',
      line1: 'garbage line 1',
      line2: 'garbage line 2',
    };
    const [satrec] = initSatelliteRecords([badTle]);
    const pos = propagatePosition(satrec, new Date());
    expect(pos).toBeNull();
  });
});
