import * as THREE from 'three';

export const DIM_BLUE = new THREE.Color('#6699ff');     // 53° main shell
export const DIM_ORANGE = new THREE.Color('#ff8844');   // 43° shell
export const DIM_YELLOW = new THREE.Color('#eecc22');   // 33° shell — warm gold
export const DIM_GREEN = new THREE.Color('#22ddbb');    // 70° shell — teal-green
export const DIM_RED = new THREE.Color('#ff4466');      // 97.6° polar shell
export const CONE_COLOR = new THREE.Color('#dd55ff');
export const BRIGHT_COLOR = new THREE.Color('#ff3366');

/** Map orbital inclination to a shell color. NaN falls through to DIM_YELLOW (33° shell). */
export function getDimColor(inclination: number): THREE.Color {
  if (inclination >= 80) return DIM_RED;      // 97.6° polar
  if (inclination >= 60) return DIM_GREEN;    // 70° shell
  if (inclination >= 48) return DIM_BLUE;     // 53° main shell
  if (inclination >= 38) return DIM_ORANGE;   // 43° shell
  return DIM_YELLOW;                          // 33° shell
}
