import type { DishStatus, DishHistory } from './types';

const DEVICE_ID = 'ut01000000-00000-demo0';
const HW_VERSION = 'rev3_proto2';
const SW_VERSION = '2024.03.15.mr42069';

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

let lastAzimuth = 180;
let lastElevation = 55;
let nextHandoffTime = Date.now() + randomBetween(15000, 30000);
let handoffInProgress = false;
let handoffStart = 0;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function generateMockStatus(elapsed: number): DishStatus {
  const t = elapsed / 1000; // time in seconds

  // Downlink: 10-250 Mbps (in bytes/s), with slow variation
  const downlinkMbps = 130 + 120 * smoothNoise(t, 0.05, 0.13, 0.31);
  const downlinkBps = clamp(downlinkMbps, 10, 250) * 1_000_000 / 8;

  // Uplink: 5-30 Mbps
  const uplinkMbps = 17.5 + 12.5 * smoothNoise(t, 0.07, 0.17, 0.41);
  const uplinkBps = clamp(uplinkMbps, 5, 30) * 1_000_000 / 8;

  // Ping: 20-60ms with occasional spikes
  let ping = 35 + 15 * smoothNoise(t, 0.1, 0.23, 0.51);
  // Occasional spike
  if (Math.random() < 0.02) {
    ping += 50 + Math.random() * 100;
  }
  ping = clamp(ping, 20, 200);

  // SNR: 4-9
  const snr = clamp(6.5 + 2.5 * smoothNoise(t, 0.03, 0.09, 0.21), 4, 9);

  // Boresight tracking: slow rotation with periodic handoffs
  const now = Date.now();
  if (now >= nextHandoffTime && !handoffInProgress) {
    handoffInProgress = true;
    handoffStart = now;
  }

  if (handoffInProgress) {
    const handoffDuration = 2000; // 2 second handoff
    const progress = (now - handoffStart) / handoffDuration;
    if (progress >= 1) {
      // Handoff complete — jump to new satellite position
      lastAzimuth = randomBetween(0, 360);
      lastElevation = randomBetween(35, 85);
      handoffInProgress = false;
      nextHandoffTime = now + randomBetween(15000, 30000);
    }
  } else {
    // Slow tracking movement
    lastAzimuth = (lastAzimuth + 0.15 + 0.05 * Math.sin(t * 0.1)) % 360;
    lastElevation = clamp(
      lastElevation + 0.03 * Math.sin(t * 0.07),
      25,
      90
    );
  }

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
    boresightAzimuth: Math.round(lastAzimuth * 100) / 100,
    boresightElevation: Math.round(lastElevation * 100) / 100,
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
      Math.round((35 + 15 * smoothNoise(t, 0.1, 0.23, 0.51)) * 100) / 100
    );

    const dlMbps = clamp(130 + 120 * smoothNoise(t, 0.05, 0.13, 0.31), 10, 250);
    downlinkThroughput.push(Math.round(dlMbps * 1_000_000 / 8));

    const ulMbps = clamp(17.5 + 12.5 * smoothNoise(t, 0.07, 0.17, 0.41), 5, 30);
    uplinkThroughput.push(Math.round(ulMbps * 1_000_000 / 8));

    snr.push(
      Math.round(clamp(6.5 + 2.5 * smoothNoise(t, 0.03, 0.09, 0.21), 4, 9) * 100) / 100
    );
  }

  return { pingLatency, downlinkThroughput, uplinkThroughput, snr };
}

export function isHandoffOccurring(): boolean {
  return handoffInProgress;
}

export function getNextHandoffTime(): number {
  return nextHandoffTime;
}
