import { describe, it, expect } from 'vitest';
import { GS_BACKHAUL_RTT_MS } from '../lib/utils/backhaul-latency';
import { GROUND_STATIONS } from '../lib/satellites/ground-stations';

describe('GS_BACKHAUL_RTT_MS', () => {
  it('has an entry for every ground station', () => {
    expect(GS_BACKHAUL_RTT_MS.length).toBe(GROUND_STATIONS.length);
  });

  it('all values are positive', () => {
    for (let i = 0; i < GS_BACKHAUL_RTT_MS.length; i++) {
      expect(GS_BACKHAUL_RTT_MS[i]).toBeGreaterThan(0);
    }
  });

  it('metro-area gateways have low backhaul (~2-6ms RTT)', () => {
    // Broadview, IL is basically in Chicago (major IXP)
    const broadviewIdx = GROUND_STATIONS.findIndex((gs) => gs.name === 'Broadview, IL');
    expect(broadviewIdx).toBeGreaterThanOrEqual(0);
    expect(GS_BACKHAUL_RTT_MS[broadviewIdx]).toBeLessThan(6);

    // Hawthorne, CA is in LA metro
    const hawthorneIdx = GROUND_STATIONS.findIndex((gs) => gs.name === 'Hawthorne, CA');
    expect(hawthorneIdx).toBeGreaterThanOrEqual(0);
    expect(GS_BACKHAUL_RTT_MS[hawthorneIdx]).toBeLessThan(6);
  });

  it('remote gateways have higher backhaul (>5ms RTT)', () => {
    // Punta Arenas, Chile is far from any major IXP
    const paIdx = GROUND_STATIONS.findIndex((gs) => gs.name === 'Punta Arenas, Chile');
    expect(paIdx).toBeGreaterThanOrEqual(0);
    expect(GS_BACKHAUL_RTT_MS[paIdx]).toBeGreaterThan(5);

    // Tromsø, Norway is remote
    const tromsoIdx = GROUND_STATIONS.findIndex((gs) => gs.name.includes('Troms'));
    expect(tromsoIdx).toBeGreaterThanOrEqual(0);
    expect(GS_BACKHAUL_RTT_MS[tromsoIdx]).toBeGreaterThan(5);
  });

  it('no backhaul exceeds 80ms RTT (sanity check)', () => {
    for (let i = 0; i < GS_BACKHAUL_RTT_MS.length; i++) {
      expect(GS_BACKHAUL_RTT_MS[i]).toBeLessThan(80);
    }
  });
});
