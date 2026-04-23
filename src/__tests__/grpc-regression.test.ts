import { describe, it, expect } from 'vitest';
import { generateMockStatus, generateMockHistory } from '../lib/grpc/mock-data';

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
