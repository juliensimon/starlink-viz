/**
 * Canonical shell classification and palette.
 *
 * Cleanup history: the inclination→shell thresholds were hand-copied in
 * three places (getDimColor, HandoffPanel shellIndex, SHELL_ALT_BANDS) and
 * the / and /fleet pages rendered *different* hex palettes for the same
 * shells. One table in config.ts now drives all of them; these tests pin
 * the derivations together so they can't drift again.
 */
import { describe, it, expect } from 'vitest';
import { SHELLS, shellIndexForInclination, SHELL_ALT_BANDS } from '../lib/config';
import { getDimColor } from '../lib/utils/shell-colors';
import { SHELL_COLORS } from '../components/fleet/shell-colors';
import { getShellId } from '../lib/fleet/classify';

describe('shellIndexForInclination', () => {
  it('classifies the five Starlink shells', () => {
    expect(SHELLS[shellIndexForInclination(33)].label).toBe('33°');
    expect(SHELLS[shellIndexForInclination(43)].label).toBe('43°');
    expect(SHELLS[shellIndexForInclination(53.05)].label).toBe('53°');
    expect(SHELLS[shellIndexForInclination(70)].label).toBe('70°');
    expect(SHELLS[shellIndexForInclination(97.6)].label).toBe('97.6°');
  });

  it('respects the SHELL_ALT_BANDS boundaries exactly', () => {
    for (let i = 0; i < SHELL_ALT_BANDS.length; i++) {
      expect(shellIndexForInclination(SHELL_ALT_BANDS[i].minInc)).toBe(i);
      expect(shellIndexForInclination(SHELL_ALT_BANDS[i].maxInc - 0.01)).toBe(i);
    }
  });

  it('falls back to the 33° bucket for NaN', () => {
    expect(shellIndexForInclination(NaN)).toBe(0);
  });
});

describe('palette consistency across pages', () => {
  it('3D scene colors derive from the canonical SHELLS palette', () => {
    for (const inc of [33, 43, 53, 70, 97.6]) {
      const idx = shellIndexForInclination(inc);
      expect(`#${getDimColor(inc).getHexString()}`).toBe(SHELLS[idx].color);
    }
  });

  it('/fleet uses the same hex per shell as the main page', () => {
    for (let i = 0; i < SHELLS.length; i++) {
      expect(SHELL_COLORS[i].color).toBe(SHELLS[i].color);
      expect(SHELL_COLORS[i].label).toBe(SHELLS[i].label);
    }
  });

  it('fleet getShellId agrees with shellIndexForInclination', () => {
    for (const inc of [33, 43, 53.2, 70, 97.6]) {
      expect(getShellId(inc)).toBe(shellIndexForInclination(inc));
    }
  });
});
