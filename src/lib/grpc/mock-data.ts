import type { DishStatus, DishHistory } from './types';

const DEVICE_ID = 'ut01000000-00000-demo0';
const HW_VERSION = 'rev4_proto3';
const SW_VERSION = '2025.12.0.mr36752-prod';

// Smooth noise using sine waves at different frequencies
function smoothNoise(t: number, ...frequencies: number[]): number {
  let sum = 0;
  for (const f of frequencies) {
    sum += Math.sin(t * f);
  }
  return sum / frequencies.length;
}

// Clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function generateMockStatus(elapsed: number): DishStatus {
  const t = elapsed / 1000; // time in seconds

  // Downlink: 25-220 Mbps (in bytes/s), with slow variation
  const downlinkMbps = 120 + 100 * smoothNoise(t, 0.05, 0.13, 0.31);
  const downlinkBps = clamp(downlinkMbps, 25, 220) * 1_000_000 / 8;

  // Uplink: 5-20 Mbps
  const uplinkMbps = 12.5 + 7.5 * smoothNoise(t, 0.07, 0.17, 0.41);
  const uplinkBps = clamp(uplinkMbps, 5, 20) * 1_000_000 / 8;

  // Ping: 25-60ms with occasional spikes
  let ping = 38 + 13 * smoothNoise(t, 0.1, 0.23, 0.51);
  // Occasional spike (handoff jitter, congestion)
  if (Math.random() < 0.02) {
    ping += 40 + Math.random() * 80;
  }
  ping = clamp(ping, 25, 200);

  // SNR: 9-12 dB (realistic Starlink Ku-band link margin)
  const snr = clamp(10.5 + 1.5 * smoothNoise(t, 0.03, 0.09, 0.21), 9, 12);

  // Boresight — az/el are now computed client-side from real satellite positions.
  // These values are ignored by the frontend but kept for API compatibility.
  const boresightAzimuth = 0;
  const boresightElevation = 0;

  // Obstruction: usually 0, occasionally spikes
  let obstruction = 0;
  if (smoothNoise(t, 0.02, 0.05) > 0.8) {
    obstruction = clamp(5 + 10 * smoothNoise(t, 0.3, 0.7), 0, 25);
  }

  // Alerts
  const alerts: string[] = [];
  if (obstruction > 15) {
    alerts.push('unexpected_location');
  }

  const dropRate = clamp(0.005 + 0.01 * smoothNoise(t, 0.08, 0.19), 0, 0.05);

  return {
    deviceId: DEVICE_ID,
    hardwareVersion: HW_VERSION,
    softwareVersion: SW_VERSION,
    state: 'CONNECTED',
    uptime: Math.floor(elapsed / 1000),
    snr: Math.round(snr * 100) / 100,
    downlinkThroughput: Math.round(downlinkBps),
    uplinkThroughput: Math.round(uplinkBps),
    popPingLatency: Math.round(ping * 100) / 100,
    popPingDropRate: Math.round(dropRate * 1000) / 1000,
    obstructionPercentTime: Math.round(obstruction * 100) / 100,
    boresightAzimuth,
    boresightElevation,
    gpsSats: 8 + Math.floor(Math.random() * 4),
    alerts,
  };
}

export function generateMockHistory(): DishHistory {
  const samples = 60;
  const now = Date.now();
  const pingLatency: number[] = [];
  const downlinkThroughput: number[] = [];
  const uplinkThroughput: number[] = [];
  const snr: number[] = [];

  for (let i = 0; i < samples; i++) {
    const t = (now - (samples - i) * 1000) / 1000;

    pingLatency.push(
      Math.round(clamp(38 + 13 * smoothNoise(t, 0.1, 0.23, 0.51), 25, 60) * 100) / 100
    );

    const dlMbps = clamp(120 + 100 * smoothNoise(t, 0.05, 0.13, 0.31), 25, 220);
    downlinkThroughput.push(Math.round(dlMbps * 1_000_000 / 8));

    const ulMbps = clamp(12.5 + 7.5 * smoothNoise(t, 0.07, 0.17, 0.41), 5, 20);
    uplinkThroughput.push(Math.round(ulMbps * 1_000_000 / 8));

    snr.push(
      Math.round(clamp(10.5 + 1.5 * smoothNoise(t, 0.03, 0.09, 0.21), 9, 12) * 100) / 100
    );
  }

  return { pingLatency, downlinkThroughput, uplinkThroughput, snr };
}

