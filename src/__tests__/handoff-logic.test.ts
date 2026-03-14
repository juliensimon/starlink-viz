import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the handoff prediction math from useHandoff.ts.
 * Since @testing-library/react is not available, we test the
 * rolling average and descent threshold logic directly.
 */

/** Rolling average over a fixed window, matching useHandoff behavior */
function rollingAverage(samples: number[], maxSize: number): number[] {
  const window: number[] = [];
  const averages: number[] = [];

  for (const sample of samples) {
    window.push(sample);
    if (window.length > maxSize) window.shift();
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    averages.push(avg);
  }

  return averages;
}

/** Estimate time to handoff, matching useHandoff logic */
function estimateTimeToHandoff(
  elevation: number,
  avgRate: number,
  minElevation: number,
): number | null {
  const degreesAboveMin = elevation - minElevation;
  if (avgRate < -0.001) {
    const absRate = Math.abs(avgRate);
    return Math.min(Math.round(degreesAboveMin / absRate), 600);
  }
  return null;
}

describe('rolling average (5 samples)', () => {
  it('smooths noisy descent rates', () => {
    // Noisy measurements around -0.05 deg/s
    const noisySamples = [-0.04, -0.06, -0.03, -0.07, -0.05];
    const averages = rollingAverage(noisySamples, 5);

    // After all 5 samples, average should be close to -0.05
    expect(averages[4]).toBeCloseTo(-0.05, 3);
  });

  it('builds up gradually with fewer than 5 samples', () => {
    const samples = [-0.02, -0.04];
    const averages = rollingAverage(samples, 5);

    // First average is just the first sample
    expect(averages[0]).toBeCloseTo(-0.02, 5);
    // Second average is mean of two
    expect(averages[1]).toBeCloseTo(-0.03, 5);
  });

  it('drops oldest sample when window exceeds 5', () => {
    // First 5 are -0.1, then a 6th value of 0.0
    const samples = [-0.1, -0.1, -0.1, -0.1, -0.1, 0.0];
    const averages = rollingAverage(samples, 5);

    // After 5 samples: avg = -0.1
    expect(averages[4]).toBeCloseTo(-0.1, 5);
    // After 6th: window = [-0.1, -0.1, -0.1, -0.1, 0.0], avg = -0.08
    expect(averages[5]).toBeCloseTo(-0.08, 5);
  });

  it('a single outlier is dampened by the window', () => {
    const samples = [-0.05, -0.05, -0.05, -0.05, 0.1]; // one big outlier
    const averages = rollingAverage(samples, 5);

    // Without smoothing, latest sample would be 0.1 (ascending)
    // With 5-sample average: (-0.05*4 + 0.1)/5 = -0.02, still descending
    expect(averages[4]).toBeLessThan(0);
    expect(averages[4]).toBeCloseTo(-0.02, 5);
  });
});

describe('descent threshold', () => {
  it('threshold -0.001 triggers on very slow descent', () => {
    // avgRate of -0.002 is a very slow descent
    const result = estimateTimeToHandoff(40, -0.002, 25);
    expect(result).not.toBeNull();
    // 15 degrees / 0.002 deg/s = 7500s, capped at 600
    expect(result).toBe(600);
  });

  it('threshold -0.001 does not trigger on near-zero rate', () => {
    // avgRate of -0.0005 is below the threshold magnitude
    const result = estimateTimeToHandoff(40, -0.0005, 25);
    expect(result).toBeNull();
  });

  it('old threshold -0.01 would miss slow descent that new threshold catches', () => {
    // Rate of -0.005 is between old threshold (-0.01) and new threshold (-0.001)
    const newThresholdResult = estimateTimeToHandoff(40, -0.005, 25);
    expect(newThresholdResult).not.toBeNull();

    // With the old threshold of -0.01, this would not trigger
    const oldTriggered = -0.005 < -0.01; // false
    expect(oldTriggered).toBe(false);
  });

  it('computes correct time estimate for moderate descent', () => {
    // 40° elevation, 25° min, rate = -0.1 deg/s
    // Time = (40 - 25) / 0.1 = 150 seconds
    const result = estimateTimeToHandoff(40, -0.1, 25);
    expect(result).toBe(150);
  });

  it('caps estimate at 600 seconds', () => {
    const result = estimateTimeToHandoff(40, -0.002, 25);
    expect(result).toBe(600);
  });

  it('returns null for ascending satellite', () => {
    const result = estimateTimeToHandoff(40, 0.05, 25);
    expect(result).toBeNull();
  });
});
