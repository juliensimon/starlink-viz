import * as THREE from 'three';
import { SHELLS, shellIndexForInclination } from '../config';

// THREE.Color instances derived from the canonical palette in config.ts.
const SHELL_THREE_COLORS = SHELLS.map((s) => new THREE.Color(s.color));

export const DIM_YELLOW = SHELL_THREE_COLORS[0];  // 33° shell — warm gold
export const DIM_ORANGE = SHELL_THREE_COLORS[1];  // 43° shell
export const DIM_BLUE = SHELL_THREE_COLORS[2];    // 53° main shell
export const DIM_GREEN = SHELL_THREE_COLORS[3];   // 70° shell — teal-green
export const DIM_RED = SHELL_THREE_COLORS[4];     // 97.6° polar shell
export const CONE_COLOR = new THREE.Color('#dd55ff');
export const BRIGHT_COLOR = new THREE.Color('#ff3366');

/** Map orbital inclination to a shell color. NaN falls through to DIM_YELLOW (33° shell). */
export function getDimColor(inclination: number): THREE.Color {
  return SHELL_THREE_COLORS[shellIndexForInclination(inclination)];
}
