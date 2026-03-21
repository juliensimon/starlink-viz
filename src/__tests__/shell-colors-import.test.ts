import { describe, it, expect } from 'vitest';
import { getDimColor, DIM_BLUE, DIM_ORANGE, DIM_YELLOW, DIM_GREEN, DIM_RED, CONE_COLOR, BRIGHT_COLOR } from '@/lib/utils/shell-colors';

describe('shell-colors shared utility', () => {
  it('exports all expected color constants', () => {
    expect(DIM_BLUE).toBeDefined();
    expect(DIM_ORANGE).toBeDefined();
    expect(DIM_YELLOW).toBeDefined();
    expect(DIM_GREEN).toBeDefined();
    expect(DIM_RED).toBeDefined();
    expect(CONE_COLOR).toBeDefined();
    expect(BRIGHT_COLOR).toBeDefined();
  });

  it('getDimColor maps inclinations to correct shell colors', () => {
    expect(getDimColor(53)).toBe(DIM_BLUE);
    expect(getDimColor(43)).toBe(DIM_ORANGE);
    expect(getDimColor(33)).toBe(DIM_YELLOW);
    expect(getDimColor(70)).toBe(DIM_GREEN);
    expect(getDimColor(97.6)).toBe(DIM_RED);
  });

  it('NaN falls to DIM_YELLOW (safe default, not polar red)', () => {
    expect(getDimColor(NaN)).toBe(DIM_YELLOW);
  });

  it('all colors have valid RGB components in [0, 1]', () => {
    for (const color of [DIM_BLUE, DIM_ORANGE, DIM_YELLOW, DIM_GREEN, DIM_RED, CONE_COLOR, BRIGHT_COLOR]) {
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(1);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(1);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(1);
    }
  });
});
