import { SHELLS } from '@/lib/config';

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Per-shell chart colors, derived from the canonical palette in config.ts
 *  so /fleet matches the 3D scene and HandoffPanel. */
export const SHELL_COLORS: Record<number, { color: string; bg: string; label: string }> =
  Object.fromEntries(
    SHELLS.map((s, i) => [i, { color: s.color, bg: rgba(s.color, 0.15), label: s.label }]),
  );
