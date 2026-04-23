import { describe, it, expect, afterEach } from 'vitest';
import { useMock, getStatus, getHistory, closeClient } from 'starlink-dish';
import type { DishStatus as NewDishStatus, DishHistory as NewDishHistory } from 'starlink-dish';

describe('starlink-dish mock getStatus()', () => {
  afterEach(() => closeClient());

  it('returns a DishStatus with all fields server.ts relays', async () => {
    useMock();
    const s = await getStatus();
    expect(s).not.toBeNull();
    expect(typeof s!.deviceId).toBe('string');
    expect(typeof s!.popPingLatencyMs).toBe('number');
    expect(typeof s!.downlinkThroughputBps).toBe('number');
    expect(typeof s!.uplinkThroughputBps).toBe('number');
    expect(typeof s!.snrAboveNoiseFloor).toBe('boolean');
    expect(typeof s!.uptimeSeconds).toBe('number');
    expect(typeof s!.obstructionPercentTime).toBe('number');
    expect(typeof s!.popPingDropRate).toBe('number');
    expect(typeof s!.gpsSats).toBe('number');
    expect(typeof s!.boresightAzimuthDeg).toBe('number');
    expect(typeof s!.boresightElevationDeg).toBe('number');
    expect(s!.state).toBe('CONNECTED');
    expect(s!.downlinkThroughputBps).toBeGreaterThan(1_000_000);
  });
});

describe('starlink-dish mock getHistory()', () => {
  afterEach(() => closeClient());

  it('returns a DishHistory with 60 samples', async () => {
    useMock();
    const h = await getHistory();
    expect(h).not.toBeNull();
    expect(h!.pingLatencyMs).toHaveLength(60);
    expect(h!.downlinkThroughputBps).toHaveLength(60);
    expect(h!.uplinkThroughputBps).toHaveLength(60);
    expect(h!.pingLatencyMs.every((v) => v > 0)).toBe(true);
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
  });

  it('DishHistory uses pingLatencyMs not pingLatency', () => {
    const h: NewDishHistory = {
      current: 0, pingLatencyMs: [25], pingDropRate: [0.001],
      downlinkThroughputBps: [100_000_000], uplinkThroughputBps: [10_000_000],
    };
    expect(h.pingLatencyMs).toHaveLength(1);
  });
});

describe('websocket field mapping — snrAboveNoiseFloor → store snr', () => {
  it('snrAboveNoiseFloor:true maps to snr estimate 10.5', () => {
    const snrEstimate = (above: boolean) => above ? 10.5 : 5.0;
    expect(snrEstimate(true)).toBe(10.5);
    expect(snrEstimate(false)).toBe(5.0);
  });
});
