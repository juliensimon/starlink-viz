import { describe, it, expect } from 'vitest';
import { generateMockStatus, generateMockHistory } from '../lib/grpc/mock-data';
import type { DishStatus as NewDishStatus, DishHistory as NewDishHistory } from 'starlink-dish';

describe('generateMockStatus()', () => {
  it('returns a DishStatus with all required fields', () => {
    const s = generateMockStatus(5000);
    expect(typeof s.deviceId).toBe('string');
    expect(typeof s.downlinkThroughput).toBe('number');
    expect(typeof s.uplinkThroughput).toBe('number');
    expect(typeof s.popPingLatency).toBe('number');
    expect(typeof s.popPingDropRate).toBe('number');
    expect(typeof s.snr).toBe('number');
    expect(typeof s.uptime).toBe('number');
    expect(typeof s.obstructionPercentTime).toBe('number');
    expect(Array.isArray(s.alerts)).toBe(true);
    expect(s.state).toBe('CONNECTED');
  });

  it('downlinkThroughput is in bytes/s (> 1_000_000 for typical values)', () => {
    const s = generateMockStatus(0);
    expect(s.downlinkThroughput).toBeGreaterThan(1_000_000);
  });

  it('snr is a numeric estimate (always 9-12 range)', () => {
    for (let t = 0; t < 10000; t += 1000) {
      const s = generateMockStatus(t);
      expect(s.snr).toBeGreaterThanOrEqual(9);
      expect(s.snr).toBeLessThanOrEqual(12);
    }
  });
});

describe('generateMockHistory()', () => {
  it('returns a DishHistory with all required fields', () => {
    const h = generateMockHistory();
    expect(Array.isArray(h.pingLatency)).toBe(true);
    expect(Array.isArray(h.downlinkThroughput)).toBe(true);
    expect(Array.isArray(h.uplinkThroughput)).toBe(true);
    expect(Array.isArray(h.snr)).toBe(true);
  });

  it('returns 60 samples', () => {
    const h = generateMockHistory();
    expect(h.pingLatency).toHaveLength(60);
    expect(h.downlinkThroughput).toHaveLength(60);
    expect(h.uplinkThroughput).toHaveLength(60);
    expect(h.snr).toHaveLength(60);
  });
});

describe('starlink-dish type contract', () => {
  it('DishStatus has snrAboveNoiseFloor boolean (not snr number)', () => {
    const s: NewDishStatus = {
      deviceId: 'test', hardwareVersion: '4.0', softwareVersion: '1.0',
      countryCode: 'US', bootcount: 0, uptimeSeconds: 0, state: 'CONNECTED',
      downlinkThroughputBps: 0, uplinkThroughputBps: 0, popPingLatencyMs: 0,
      popPingDropRate: 0, obstructionPercentTime: 0, currentlyObstructed: false,
      snrAboveNoiseFloor: true, snrPersistentlyLow: false,
      boresightAzimuthDeg: 0, boresightElevationDeg: 0,
      gpsValid: true, gpsSats: 0, ethSpeedMbps: 0, alerts: [],
    };
    expect(typeof s.snrAboveNoiseFloor).toBe('boolean');
    // @ts-expect-error — old snr field must not exist on new type
    expect(s.snr).toBeUndefined();
  });

  it('DishHistory uses pingLatencyMs not pingLatency', () => {
    const h: NewDishHistory = {
      current: 0,
      pingLatencyMs: [25, 30],
      pingDropRate: [0.001],
      downlinkThroughputBps: [100_000_000],
      uplinkThroughputBps: [10_000_000],
    };
    expect(h.pingLatencyMs).toHaveLength(2);
    // @ts-expect-error — old pingLatency field must not exist
    expect(h.pingLatency).toBeUndefined();
  });
});
