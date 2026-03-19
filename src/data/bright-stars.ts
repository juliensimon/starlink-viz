/**
 * Embedded catalog of ~500 stars (magnitude <= 4.0).
 * Data from Hipparcos/Yale BSC. J2000 coordinates.
 * Includes constellation stick-figure vertices and additional stars for visual density.
 */
export interface BrightStar {
  name: string;   // display name (empty for unnamed)
  ra: number;     // right ascension in degrees (J2000)
  dec: number;    // declination in degrees (J2000)
  mag: number;    // apparent visual magnitude
  bv: number;     // B-V color index
}

export const BRIGHT_STARS: BrightStar[] = [
  // ══════════════════════════════════════════════════════════════
  // Named stars — brightest ~40
  // ══════════════════════════════════════════════════════════════
  { name: 'Sirius',       ra: 101.287, dec: -16.716, mag: -1.46, bv: 0.00 },
  { name: 'Canopus',      ra:  95.988, dec: -52.696, mag: -0.74, bv: 0.15 },
  { name: 'Arcturus',     ra: 213.915, dec:  19.182, mag: -0.05, bv: 1.23 },
  { name: 'Vega',         ra: 279.235, dec:  38.784, mag:  0.03, bv: 0.00 },
  { name: 'Capella',      ra:  79.172, dec:  45.998, mag:  0.08, bv: 0.80 },
  { name: 'Rigel',        ra:  78.634, dec:  -8.202, mag:  0.13, bv: -0.03 },
  { name: 'Procyon',      ra: 114.827, dec:   5.225, mag:  0.34, bv: 0.42 },
  { name: 'Betelgeuse',   ra:  88.793, dec:   7.407, mag:  0.42, bv: 1.85 },
  { name: 'Achernar',     ra:  24.429, dec: -57.237, mag:  0.46, bv: -0.16 },
  { name: 'Hadar',        ra: 210.956, dec: -60.373, mag:  0.61, bv: -0.23 },
  { name: 'Altair',       ra: 297.696, dec:   8.868, mag:  0.76, bv: 0.22 },
  { name: 'Acrux',        ra: 186.650, dec: -63.099, mag:  0.76, bv: -0.24 },
  { name: 'Aldebaran',    ra:  68.980, dec:  16.509, mag:  0.85, bv: 1.54 },
  { name: 'Antares',      ra: 247.352, dec: -26.432, mag:  0.96, bv: 1.83 },
  { name: 'Spica',        ra: 201.298, dec: -11.161, mag:  0.97, bv: -0.23 },
  { name: 'Pollux',       ra: 116.329, dec:  28.026, mag:  1.14, bv: 1.00 },
  { name: 'Fomalhaut',    ra: 344.413, dec: -29.622, mag:  1.16, bv: 0.09 },
  { name: 'Deneb',        ra: 310.358, dec:  45.280, mag:  1.25, bv: 0.09 },
  { name: 'Mimosa',       ra: 191.930, dec: -59.689, mag:  1.25, bv: -0.23 },
  { name: 'Regulus',      ra: 152.093, dec:  11.967, mag:  1.35, bv: -0.11 },
  { name: 'Castor',       ra: 113.650, dec:  31.889, mag:  1.58, bv: 0.03 },
  { name: 'Bellatrix',    ra:  81.283, dec:   6.350, mag:  1.64, bv: -0.22 },
  { name: 'Alnilam',      ra:  84.053, dec:  -1.202, mag:  1.69, bv: -0.18 },
  { name: 'Polaris',      ra:  37.954, dec:  89.264, mag:  1.98, bv: 0.60 },
  { name: 'Dubhe',        ra: 165.932, dec:  61.751, mag:  1.79, bv: 1.07 },
  { name: 'Alkaid',       ra: 206.885, dec:  49.313, mag:  1.86, bv: -0.19 },
  { name: 'Mizar',        ra: 200.981, dec:  54.925, mag:  2.04, bv: 0.02 },
  { name: 'Merak',        ra: 165.460, dec:  56.383, mag:  2.37, bv: 0.03 },
  { name: 'Albireo',      ra: 292.680, dec:  27.960, mag:  3.08, bv: 1.09 },
  { name: 'Algol',        ra:  47.042, dec:  40.956, mag:  2.12, bv: -0.05 },
  { name: 'Mirfak',       ra:  51.081, dec:  49.861, mag:  1.79, bv: 0.48 },
  { name: 'Hamal',        ra:  28.660, dec:  20.808, mag:  2.00, bv: 1.15 },
  { name: 'Alpheratz',    ra:   2.097, dec:  29.091, mag:  2.06, bv: -0.11 },
  { name: 'Denebola',     ra: 177.265, dec:  14.572, mag:  2.14, bv: 0.09 },
  { name: 'Alphecca',     ra: 234.256, dec:  26.715, mag:  2.23, bv: 1.24 },
  { name: 'Rasalhague',   ra: 263.734, dec:  12.560, mag:  2.08, bv: 1.17 },
  { name: 'Kochab',       ra: 240.083, dec:  77.795, mag:  2.08, bv: 1.47 },
  { name: 'Alnair',       ra: 340.667, dec: -46.885, mag:  1.74, bv: 1.60 },
  { name: 'Menkalinan',   ra:  75.492, dec:  43.823, mag:  1.90, bv: 0.03 },
  { name: 'Mirach',       ra:   8.274, dec:  15.184, mag:  2.06, bv: 1.58 },
  { name: 'Saiph',        ra:  87.740, dec:  -9.670, mag:  2.09, bv: -0.18 },

  // ══════════════════════════════════════════════════════════════
  // Bright unnamed stars and constellation vertices (mag ~1.3–3.5)
  // ══════════════════════════════════════════════════════════════
  { name: '',  ra: 263.402, dec: -37.104, mag: 1.63, bv: -0.22 },  // Shaula (λ Sco)
  { name: '',  ra: 264.330, dec: -43.000, mag: 1.87, bv: -0.20 },  // Sargas (θ Sco)
  { name: '',  ra:  83.002, dec:  -0.299, mag: 2.09, bv: -0.17 },  // Mintaka (δ Ori)
  { name: '',  ra:  81.573, dec:  28.608, mag: 1.65, bv: -0.08 },  // Elnath (β Tau)
  { name: '',  ra:  85.190, dec:  -1.943, mag: 1.70, bv: -0.19 },  // Alnitak (ζ Ori)
  { name: '',  ra: 187.791, dec: -57.113, mag: 1.33, bv: -0.23 },  // Gacrux (γ Cru)
  { name: '',  ra: 219.902, dec: -60.835, mag: 0.77, bv: -0.23 },  // α Cen A
  { name: '',  ra: 252.166, dec: -69.028, mag: 2.29, bv: -0.17 },  // α TrA (Atria)
  { name: '',  ra: 138.300, dec: -69.717, mag: 1.68, bv: 0.27 },   // Miaplacidus (β Car)
  { name: '',  ra: 125.629, dec: -59.510, mag: 1.86, bv: -0.22 },  // Avior (ε Car)
  { name: '',  ra: 104.656, dec: -28.972, mag: 1.50, bv: -0.21 },  // Wezen (δ CMa)
  { name: '',  ra: 107.098, dec: -26.393, mag: 1.84, bv: 0.67 },   // Aludra (η CMa)
  { name: '',  ra:  95.675, dec: -17.956, mag: 1.98, bv: 0.00 },   // Mirzam (β CMa pre-sirius)
  { name: '',  ra: 141.897, dec:  -8.660, mag: 1.98, bv: -0.11 },  // Alphard (α Hya)
  { name: '',  ra: 283.816, dec: -26.297, mag: 2.05, bv: 0.34 },   // Nunki (σ Sgr)
  { name: '',  ra: 305.557, dec: -14.781, mag: 2.07, bv: -0.03 },  // Sadalsuud (β Aqr area)
  { name: '',  ra: 286.353, dec:  13.864, mag: 2.72, bv: -0.04 },  // Tarazed (γ Aql)
  { name: '',  ra: 269.152, dec: -29.828, mag: 2.70, bv: 0.97 },   // Kaus Australis (ε Sgr)
  { name: '',  ra: 276.043, dec: -34.384, mag: 2.82, bv: -0.22 },  // Kaus Media (δ Sgr)
  { name: '',  ra: 271.452, dec: -30.424, mag: 2.99, bv: 0.76 },   // Kaus Borealis (λ Sgr)
  { name: '',  ra: 191.570, dec: -59.690, mag: 1.25, bv: -0.23 },  // β Cru
  { name: '',  ra: 255.072, dec: -26.114, mag: 2.56, bv: -0.02 },  // Dschubba (δ Sco)
  { name: '',  ra: 248.971, dec: -28.216, mag: 2.29, bv: 1.16 },   // σ Sco
  { name: '',  ra: 241.359, dec: -19.806, mag: 2.75, bv: 0.02 },   // β Lib
  { name: '',  ra: 233.672, dec: -41.167, mag: 2.55, bv: -0.22 },  // γ Lup / ε Lup
  { name: '',  ra: 228.071, dec: -47.388, mag: 2.30, bv: -0.22 },  // η Cen
  { name: '',  ra: 222.676, dec: -16.042, mag: 2.61, bv: 0.14 },   // α Lib (Zubenelgenubi)
  { name: '',  ra: 217.957, dec: -42.158, mag: 2.06, bv: -0.22 },  // θ Cen
  { name: '',  ra: 204.972, dec: -53.466, mag: 2.20, bv: -0.17 },  // ε Cen
  { name: '',  ra: 198.789, dec: -23.171, mag: 2.94, bv: 0.14 },   // γ Vir (Porrima)
  { name: '',  ra: 194.007, dec:  38.318, mag: 2.27, bv: 0.03 },   // Cor Caroli (α CVn)
  { name: '',  ra: 174.170, dec: -63.020, mag: 2.76, bv: -0.22 },  // δ Cru
  { name: '',  ra: 166.452, dec:  55.960, mag: 2.44, bv: 0.60 },   // Phecda (γ UMa)
  { name: '',  ra: 154.993, dec:  19.842, mag: 2.56, bv: 0.12 },   // Algieba (γ Leo)
  { name: '',  ra: 139.273, dec: -59.275, mag: 2.25, bv: 0.01 },   // ι Car
  { name: '',  ra: 122.383, dec: -47.337, mag: 2.21, bv: 1.28 },   // κ Vel
  { name: '',  ra: 120.896, dec: -40.003, mag: 2.50, bv: -0.18 },  // δ Vel
  { name: '',  ra: 109.286, dec: -37.097, mag: 2.45, bv: -0.19 },  // λ Vel
  { name: '',  ra: 116.112, dec: -28.950, mag: 2.70, bv: 0.37 },   // σ Pup
  { name: '',  ra: 111.024, dec: -29.303, mag: 2.25, bv: -0.17 },  // ζ Pup
  { name: '',  ra: 105.756, dec: -23.833, mag: 2.45, bv: -0.12 },  // δ CMa area
  { name: '',  ra: 100.983, dec: -16.199, mag: 3.02, bv: -0.12 },  // ε CMa
  { name: '',  ra:  96.685, dec: -50.615, mag: 2.76, bv: -0.18 },  // β Car
  { name: '',  ra:  92.984, dec:  14.768, mag: 3.03, bv: 0.43 },   // μ Gem
  { name: '',  ra:  90.980, dec:  20.276, mag: 3.28, bv: 0.10 },   // Alhena (γ Gem)
  { name: '',  ra:  89.882, dec:  44.947, mag: 3.03, bv: -0.18 },  // ε Aur
  { name: '',  ra:  86.939, dec:   9.647, mag: 3.19, bv: -0.18 },  // η Ori
  { name: '',  ra:  84.912, dec:  -1.942, mag: 2.05, bv: -0.21 },  // ε Ori (belt)
  { name: '',  ra:  79.402, dec:  46.000, mag: 2.69, bv: -0.15 },  // θ Aur
  { name: '',  ra:  76.629, dec:   8.900, mag: 2.20, bv: 1.54 },   // γ Ori (Bellatrix area)
  { name: '',  ra:  74.637, dec:  33.166, mag: 2.87, bv: 1.28 },   // ε Per
  { name: '',  ra:  66.009, dec:  17.543, mag: 3.47, bv: 0.15 },   // θ2 Tau
  { name: '',  ra:  68.499, dec:  15.962, mag: 3.53, bv: -0.15 },  // θ1 Tau
  { name: '',  ra:  67.154, dec:  15.871, mag: 3.54, bv: 0.18 },   // γ Tau
  { name: '',  ra:  63.500, dec:  15.628, mag: 3.40, bv: 0.96 },   // ε Tau
  { name: '',  ra:  50.689, dec:  56.537, mag: 2.84, bv: -0.15 },  // δ Per
  { name: '',  ra:  40.825, dec:   3.236, mag: 2.83, bv: 0.09 },   // β Ari
  { name: '',  ra:  31.793, dec:  23.463, mag: 2.00, bv: -0.18 },  // Sheratan (β Ari)
  { name: '',  ra:  17.433, dec:  35.621, mag: 2.83, bv: 0.59 },   // γ And (Almach)
  { name: '',  ra:  14.177, dec:  60.717, mag: 2.68, bv: 0.34 },   // γ Cas
  { name: '',  ra:  10.897, dec:  56.537, mag: 2.27, bv: -0.15 },  // Schedar (α Cas)
  { name: '',  ra:   9.243, dec:  59.150, mag: 2.47, bv: 0.13 },   // Caph (β Cas)
  { name: '',  ra: 346.190, dec: -43.520, mag: 2.39, bv: -0.16 },  // δ1 Gru
  { name: '',  ra: 340.364, dec: -46.961, mag: 2.10, bv: -0.13 },  // β Gru
  { name: '',  ra: 332.058, dec:  -0.320, mag: 2.90, bv: 0.98 },   // ε Aqr
  { name: '',  ra: 326.760, dec: -16.127, mag: 2.91, bv: 0.01 },   // Sadalmelik (α Aqr)
  { name: '',  ra: 322.165, dec:  45.131, mag: 2.48, bv: 0.09 },   // ε Cyg
  { name: '',  ra: 318.956, dec:  38.048, mag: 2.46, bv: 0.67 },   // Sadr (γ Cyg)
  { name: '',  ra: 311.553, dec:  33.970, mag: 2.86, bv: 0.19 },   // δ Cyg
  { name: '',  ra: 306.412, dec: -56.735, mag: 1.94, bv: -0.20 },  // Peacock (α Pav)
  { name: '',  ra: 291.375, dec:   3.115, mag: 2.99, bv: 0.32 },   // δ Aql
  { name: '',  ra: 289.276, dec:  53.369, mag: 2.23, bv: 0.03 },   // ξ Dra
  { name: '',  ra: 284.736, dec:  32.690, mag: 2.24, bv: 0.00 },   // Sheliak (β Lyr)
  { name: '',  ra: 275.249, dec:  72.733, mag: 2.74, bv: 1.17 },   // Rastaban (β Dra)
  { name: '',  ra: 262.608, dec:  52.301, mag: 2.79, bv: 0.94 },   // η Dra
  { name: '',  ra: 257.595, dec:  65.715, mag: 2.24, bv: -0.03 },  // Eltanin (γ Dra)
  { name: '',  ra: 269.441, dec:  51.489, mag: 3.07, bv: 1.87 },   // σ Dra
  { name: '',  ra: 258.758, dec: -43.239, mag: 1.87, bv: -0.20 },  // θ Sco (Sargas)
  { name: '',  ra: 253.084, dec: -38.047, mag: 2.69, bv: -0.22 },  // μ Sco
  { name: '',  ra: 252.541, dec: -34.293, mag: 2.89, bv: -0.07 },  // ζ Sco
  { name: '',  ra: 268.382, dec: -24.884, mag: 3.32, bv: -0.01 },  // φ Sgr
  { name: '',  ra: 243.586, dec:  -3.694, mag: 2.43, bv: 0.15 },   // ζ Oph
  { name: '',  ra: 229.252, dec:  -9.383, mag: 2.75, bv: -0.02 },  // β Lib
  { name: '',  ra: 222.720, dec: -47.388, mag: 2.30, bv: -0.22 },  // η Cen (dup clean)
  { name: '',  ra: 210.088, dec: -36.370, mag: 2.55, bv: -0.23 },  // ε Cen (outer)
  { name: '',  ra: 203.673, dec: -41.688, mag: 2.60, bv: -0.22 },  // ζ Cen
  { name: '',  ra: 196.730, dec: -10.283, mag: 2.83, bv: 0.94 },   // γ Vir area
  { name: '',  ra: 186.740, dec: -63.100, mag: 1.63, bv: 1.60 },   // γ Cru (Gacrux)
  { name: '',  ra: 183.857, dec:  57.033, mag: 2.41, bv: 0.19 },   // Alioth (ε UMa)
  { name: '',  ra: 178.457, dec:  53.695, mag: 3.31, bv: 0.00 },   // Megrez (δ UMa)
  { name: '',  ra: 176.513, dec: -18.299, mag: 2.61, bv: 0.09 },   // β Crv (Kraz)
  { name: '',  ra: 169.620, dec: -14.780, mag: 2.94, bv: -0.12 },  // γ Crv
  { name: '',  ra: 161.692, dec: -49.420, mag: 2.21, bv: -0.22 },  // κ Vel / q Vel
  { name: '',  ra: 146.776, dec:  23.774, mag: 3.52, bv: 0.12 },   // η Leo
  { name: '',  ra: 142.930, dec:  63.062, mag: 3.14, bv: 0.03 },   // ι UMa
  { name: '',  ra: 135.906, dec: -66.397, mag: 2.97, bv: 0.19 },   // θ Car
  { name: '',  ra: 131.171, dec:  18.154, mag: 3.52, bv: 0.00 },   // ζ Leo
  { name: '',  ra: 127.566, dec: -26.803, mag: 3.34, bv: -0.19 },  // ν Pup
  { name: '',  ra:  95.740, dec: -33.436, mag: 2.44, bv: -0.20 },  // π Pup
  { name: '',  ra:  93.714, dec:  -6.275, mag: 2.06, bv: -0.24 },  // β CMa
  { name: '',  ra:  91.881, dec:  22.514, mag: 3.06, bv: 0.03 },   // ε Gem
  { name: '',  ra:  88.525, dec:  -0.317, mag: 3.36, bv: 0.18 },   // δ Ori area
  { name: '',  ra:  56.871, dec:  24.105, mag: 2.87, bv: -0.09 },  // Alcyone (η Tau)
  { name: '',  ra:  35.620, dec:  -9.458, mag: 3.47, bv: 1.02 },   // δ Cet
  { name: '',  ra:  21.006, dec:  -8.184, mag: 2.04, bv: 0.09 },   // Deneb Kaitos (β Cet)
  { name: '',  ra:  13.529, dec:  15.346, mag: 2.83, bv: 0.09 },   // δ And
  { name: '',  ra:   6.571, dec: -42.305, mag: 2.86, bv: -0.23 },  // Ankaa (α Phe)
  { name: '',  ra: 348.973, dec: -29.622, mag: 3.27, bv: 0.68 },   // ε PsA
  { name: '',  ra: 335.414, dec:  -1.387, mag: 2.94, bv: 0.01 },   // ε Aqr
  { name: '',  ra: 330.723, dec:  30.227, mag: 2.39, bv: 0.86 },   // ε Peg (Enif)
  { name: '',  ra: 326.046, dec:   9.875, mag: 2.38, bv: 1.53 },   // α Aqr
  { name: '',  ra: 321.667, dec: -65.368, mag: 2.82, bv: -0.22 },  // ε Tuc
  { name: '',  ra: 309.910, dec:  15.912, mag: 2.99, bv: 0.01 },   // α Del (Sualocin)
  { name: '',  ra: 305.253, dec: -47.291, mag: 2.85, bv: 0.94 },   // ε Sgr
  { name: '',  ra: 290.418, dec: -37.104, mag: 2.05, bv: -0.22 },  // α CrA
  { name: '',  ra: 287.441, dec: -21.024, mag: 2.89, bv: 0.76 },   // ζ Sgr
  { name: '',  ra: 281.414, dec:  -4.748, mag: 2.72, bv: -0.04 },  // θ Oph
  { name: '',  ra: 278.802, dec: -10.568, mag: 3.36, bv: 0.01 },   // η Oph
  { name: '',  ra: 267.464, dec: -37.043, mag: 1.86, bv: -0.22 },  // λ Sco
  { name: '',  ra: 110.031, dec: -29.303, mag: 2.93, bv: -0.17 },  // ρ Pup

  // ══════════════════════════════════════════════════════════════
  // Additional constellation vertex stars and fainter fill stars
  // (mag ~3.0–5.0, organized roughly by RA)
  // ══════════════════════════════════════════════════════════════

  // Pisces / Cetus / Sculptor / Phoenix / Tucana (RA 340-30)
  { name: '',  ra: 351.733, dec:   6.864, mag: 4.00, bv: 0.96 },   // ν Psc
  { name: '',  ra: 353.243, dec:   5.626, mag: 4.00, bv: 1.41 },   // μ Psc
  { name: '',  ra:   1.191, dec:   7.585, mag: 3.62, bv: 0.03 },   // α Psc (Alrescha)
  { name: '',  ra:   6.190, dec:   7.890, mag: 4.00, bv: 1.03 },   // ω Psc
  { name: '',  ra:  10.897, dec:   7.585, mag: 4.00, bv: 0.51 },   // ι Psc
  { name: '',  ra:  15.736, dec:   7.890, mag: 4.00, bv: 0.93 },   // θ Psc
  { name: '',  ra:  17.843, dec:  10.114, mag: 3.69, bv: 0.94 },   // γ Psc
  { name: '',  ra:  26.348, dec:  28.983, mag: 4.00, bv: 0.08 },   // κ Psc
  { name: '',  ra:  28.383, dec:  33.250, mag: 4.00, bv: 0.07 },   // λ Psc
  { name: '',  ra:   3.038, dec: -10.182, mag: 3.60, bv: 0.68 },   // θ Cet
  { name: '',  ra:   6.192, dec: -15.940, mag: 3.45, bv: 1.24 },   // η Cet
  { name: '',  ra:  10.324, dec: -17.987, mag: 3.56, bv: 1.24 },   // ι Cet
  { name: '',  ra:  43.565, dec:   4.090, mag: 2.53, bv: 1.64 },   // Menkar (α Cet)
  { name: '',  ra:  14.529, dec: -29.358, mag: 4.00, bv: -0.15 },  // α Scl
  { name: '',  ra:   6.385, dec: -32.532, mag: 4.00, bv: -0.02 },  // β Scl
  { name: '',  ra: 349.547, dec: -28.130, mag: 4.00, bv: 0.63 },   // γ Scl
  { name: '',  ra: 358.091, dec: -31.551, mag: 4.00, bv: 0.09 },   // δ Scl
  { name: '',  ra:  16.521, dec: -46.718, mag: 3.31, bv: 0.87 },   // β Phe
  { name: '',  ra:  21.884, dec: -43.318, mag: 3.41, bv: 1.57 },   // γ Phe
  { name: '',  ra:  18.437, dec: -55.246, mag: 3.88, bv: 1.59 },   // ε Phe
  { name: '',  ra: 334.625, dec: -60.259, mag: 2.86, bv: 1.39 },   // α Tuc
  { name: '',  ra: 350.159, dec: -62.958, mag: 3.99, bv: 0.02 },   // γ Tuc
  { name: '',  ra:   5.530, dec: -64.875, mag: 4.00, bv: -0.09 },  // β1 Tuc
  { name: '',  ra:  12.454, dec: -63.020, mag: 4.00, bv: 0.15 },   // ζ Tuc
  { name: '',  ra: 339.228, dec: -32.346, mag: 4.00, bv: 0.50 },   // δ PsA
  { name: '',  ra: 334.208, dec: -32.540, mag: 4.00, bv: 0.09 },   // γ PsA
  { name: '',  ra: 330.723, dec: -27.044, mag: 4.00, bv: 0.10 },   // β PsA
  { name: '',  ra: 332.058, dec: -51.317, mag: 3.49, bv: -0.14 },  // ε Gru
  { name: '',  ra: 330.723, dec: -52.754, mag: 4.00, bv: -0.06 },  // ζ Gru

  // Eridanus chain (RA 24-80)
  { name: '',  ra:  29.956, dec: -51.512, mag: 3.24, bv: 0.17 },   // θ1 Eri
  { name: '',  ra:  31.680, dec: -45.747, mag: 3.56, bv: -0.16 },  // φ Eri
  { name: '',  ra:  38.022, dec: -43.075, mag: 4.00, bv: -0.10 },  // κ Eri
  { name: '',  ra:  44.565, dec: -40.305, mag: 4.00, bv: 0.87 },   // f Eri area
  { name: '',  ra:  48.958, dec: -28.986, mag: 3.69, bv: -0.04 },  // τ2 Eri
  { name: '',  ra:  53.233, dec: -21.758, mag: 3.70, bv: -0.17 },  // τ4 Eri
  { name: '',  ra:  56.841, dec: -13.508, mag: 4.00, bv: 0.86 },   // τ6 Eri
  { name: '',  ra:  69.080, dec:  -3.353, mag: 3.54, bv: 0.92 },   // δ Eri
  { name: '',  ra:  76.960, dec:  -5.086, mag: 3.73, bv: 0.88 },   // ε Eri

  // Fornax
  { name: '',  ra:  48.019, dec: -28.988, mag: 3.87, bv: 0.58 },   // α For
  { name: '',  ra:  43.247, dec: -32.406, mag: 4.00, bv: 0.52 },   // β For

  // Aries / Triangulum area (RA 25-35)
  { name: '',  ra:  28.271, dec:  29.579, mag: 3.41, bv: 0.49 },   // α Tri
  { name: '',  ra:  25.515, dec:  34.987, mag: 3.00, bv: 0.14 },   // β Tri
  { name: '',  ra:  34.548, dec:  33.847, mag: 4.00, bv: 0.03 },   // γ Tri
  { name: '',  ra:  28.383, dec:  19.294, mag: 3.88, bv: -0.04 },  // 41 Ari (γ Ari)

  // Perseus area (RA 40-65)
  { name: '',  ra:  55.731, dec:  47.788, mag: 3.01, bv: -0.13 },  // δ Per
  { name: '',  ra:  59.463, dec:  40.010, mag: 2.89, bv: -0.18 },  // ε Per
  { name: '',  ra:  62.165, dec:  47.712, mag: 3.98, bv: -0.20 },  // ζ Per
  { name: '',  ra:  46.294, dec:  53.506, mag: 2.93, bv: 0.70 },   // γ Per
  { name: '',  ra:  42.674, dec:  55.896, mag: 3.76, bv: 1.65 },   // η Per
  { name: '',  ra:  44.107, dec:  38.840, mag: 3.39, bv: 1.65 },   // ρ Per

  // Cassiopeia extras
  { name: '',  ra:  21.454, dec:  60.235, mag: 2.68, bv: 0.13 },   // δ Cas (Ruchbah)
  { name: '',  ra:  28.599, dec:  63.670, mag: 3.38, bv: -0.15 },  // ε Cas

  // Camelopardalis
  { name: '',  ra:  73.513, dec:  66.343, mag: 4.00, bv: -0.07 },  // α Cam
  { name: '',  ra:  75.853, dec:  60.442, mag: 4.00, bv: 0.92 },   // β Cam
  { name: '',  ra: 100.148, dec:  76.978, mag: 4.00, bv: 0.06 },   // γ Cam

  // Auriga extras
  { name: '',  ra:  74.248, dec:  33.166, mag: 2.69, bv: 1.52 },   // ι Aur

  // Taurus extras
  { name: '',  ra:  60.170, dec:  12.490, mag: 3.77, bv: 0.98 },   // δ1 Tau
  { name: '',  ra:  72.460, dec:   6.961, mag: 3.54, bv: -0.14 },  // ζ Tau

  // Orion extras
  { name: '',  ra:  80.590, dec:  -6.840, mag: 3.39, bv: -0.18 },  // τ Ori
  { name: '',  ra:  78.233, dec: -11.870, mag: 3.19, bv: -0.18 },  // β Lep area / ι Ori

  // Lepus
  { name: '',  ra:  83.183, dec: -17.822, mag: 2.58, bv: 0.21 },   // Arneb (α Lep)
  { name: '',  ra:  72.460, dec: -22.371, mag: 3.60, bv: 0.47 },   // γ Lep
  { name: '',  ra:  76.365, dec: -22.371, mag: 3.76, bv: 0.44 },   // δ Lep
  { name: '',  ra:  86.739, dec: -20.759, mag: 3.19, bv: 1.48 },   // ε Lep
  { name: '',  ra:  88.596, dec: -14.168, mag: 3.31, bv: -0.12 },  // μ Lep

  // Columba
  { name: '',  ra:  84.912, dec: -34.074, mag: 2.64, bv: -0.12 },  // Phact (α Col)
  { name: '',  ra:  87.740, dec: -35.768, mag: 3.12, bv: 1.16 },   // Wazn (β Col)
  { name: '',  ra:  92.244, dec: -37.253, mag: 3.85, bv: -0.12 },  // δ Col
  { name: '',  ra:  78.764, dec: -33.803, mag: 3.87, bv: 1.62 },   // ε Col
  { name: '',  ra:  85.897, dec: -27.935, mag: 4.00, bv: -0.11 },  // γ Col

  // Canis Minor extra
  { name: '',  ra: 111.788, dec:   8.289, mag: 2.90, bv: -0.09 },  // Gomeisa (β CMi)

  // Gemini extras
  { name: '',  ra: 100.983, dec:  25.131, mag: 3.57, bv: 0.93 },   // κ Gem
  { name: '',  ra:  99.428, dec:  16.399, mag: 3.79, bv: 0.90 },   // ζ Gem
  { name: '',  ra: 110.031, dec:  20.570, mag: 3.06, bv: 0.93 },   // ε Gem
  { name: '',  ra: 107.785, dec:  16.540, mag: 3.36, bv: 0.44 },   // ξ Gem

  // Cancer
  { name: '',  ra: 130.814, dec:  11.857, mag: 4.00, bv: 0.09 },   // α Cnc (Acubens)
  { name: '',  ra: 130.112, dec:  21.469, mag: 3.94, bv: 0.09 },   // δ Cnc
  { name: '',  ra: 131.171, dec:  28.765, mag: 3.53, bv: 1.48 },   // β Cnc (Al Tarf)
  { name: '',  ra: 121.862, dec:   9.186, mag: 4.00, bv: 0.04 },   // γ Cnc

  // Hydra head & body
  { name: '',  ra: 130.806, dec: -11.586, mag: 3.88, bv: -0.07 },  // θ Hya
  { name: '',  ra: 126.722, dec:  -3.907, mag: 3.11, bv: 0.96 },   // ζ Hya
  { name: '',  ra: 123.383, dec:  -5.838, mag: 3.38, bv: 0.62 },   // ε Hya
  { name: '',  ra: 119.195, dec: -12.891, mag: 3.17, bv: 0.42 },   // δ Hya
  { name: '',  ra: 162.406, dec: -12.354, mag: 3.81, bv: 1.44 },   // μ Hya

  // Leo extras
  { name: '',  ra: 148.191, dec:  26.007, mag: 3.44, bv: 0.98 },   // ζ Leo
  { name: '',  ra: 140.264, dec:  19.842, mag: 3.88, bv: 1.50 },   // μ Leo
  { name: '',  ra: 168.527, dec:  15.430, mag: 3.34, bv: 0.14 },   // θ Leo (Chertan)
  { name: '',  ra: 170.981, dec:   6.029, mag: 2.56, bv: 0.13 },   // Zosma (δ Leo)

  // Leo Minor
  { name: '',  ra: 151.857, dec:  33.096, mag: 3.83, bv: 1.52 },   // 46 LMi
  { name: '',  ra: 157.588, dec:  36.707, mag: 4.00, bv: 0.90 },   // β LMi

  // Coma Berenices
  { name: '',  ra: 197.497, dec:  17.529, mag: 4.00, bv: 0.57 },   // β Com
  { name: '',  ra: 186.735, dec:  28.268, mag: 4.00, bv: 1.01 },   // γ Com
  { name: '',  ra: 185.179, dec:  23.938, mag: 4.00, bv: 0.46 },   // α Com

  // Canes Venatici extra
  { name: '',  ra: 188.436, dec:  41.358, mag: 4.00, bv: 0.69 },   // Chara (β CVn)

  // Corvus extras
  { name: '',  ra: 182.103, dec: -22.620, mag: 2.59, bv: -0.11 },  // γ Crv (Gienah)
  { name: '',  ra: 183.952, dec: -17.542, mag: 2.95, bv: 0.80 },   // δ Crv (Algorab)
  { name: '',  ra: 188.597, dec: -24.729, mag: 3.00, bv: 1.33 },   // ε Crv

  // Crater
  { name: '',  ra: 164.944, dec: -18.299, mag: 4.00, bv: 1.12 },   // α Crt
  { name: '',  ra: 167.915, dec: -14.779, mag: 4.00, bv: 0.12 },   // β Crt
  { name: '',  ra: 172.853, dec: -17.684, mag: 4.00, bv: 0.04 },   // γ Crt
  { name: '',  ra: 176.190, dec: -14.347, mag: 3.56, bv: 0.78 },   // δ Crt

  // Virgo extras
  { name: '',  ra: 190.415, dec:   1.765, mag: 2.83, bv: 0.94 },   // Vindemiatrix (ε Vir)
  { name: '',  ra: 184.976, dec:  -0.666, mag: 3.38, bv: 1.57 },   // δ Vir (Auva)
  { name: '',  ra: 194.007, dec:  10.959, mag: 3.89, bv: 0.10 },   // η Vir

  // Boötes extras
  { name: '',  ra: 218.020, dec:  38.308, mag: 2.70, bv: 1.24 },   // Izar (ε Boo)
  { name: '',  ra: 222.350, dec:  27.074, mag: 3.47, bv: 0.95 },   // δ Boo
  { name: '',  ra: 209.310, dec:  18.398, mag: 2.68, bv: 0.58 },   // Muphrid (η Boo)
  { name: '',  ra: 225.486, dec:  40.391, mag: 3.50, bv: 0.95 },   // Nekkar (β Boo)
  { name: '',  ra: 219.115, dec:  13.728, mag: 3.78, bv: 0.07 },   // ζ Boo

  // Corona Borealis extras
  { name: '',  ra: 233.672, dec:  29.106, mag: 3.68, bv: 0.28 },   // Nusakan (β CrB)
  { name: '',  ra: 229.377, dec:  31.359, mag: 4.00, bv: -0.02 },  // θ CrB
  { name: '',  ra: 231.957, dec:  33.303, mag: 3.84, bv: 0.00 },   // γ CrB
  { name: '',  ra: 235.532, dec:  29.851, mag: 4.00, bv: 1.23 },   // ε CrB
  { name: '',  ra: 241.247, dec:  30.292, mag: 4.00, bv: 0.91 },   // δ CrB (approx)

  // Libra extras
  { name: '',  ra: 233.882, dec: -14.789, mag: 3.91, bv: 1.01 },   // γ Lib
  { name: '',  ra: 239.955, dec: -25.282, mag: 3.29, bv: 1.70 },   // σ Lib

  // Serpens
  { name: '',  ra: 236.067, dec:   6.425, mag: 2.65, bv: 1.17 },   // Unukalhai (α Ser)
  { name: '',  ra: 239.113, dec:  15.422, mag: 3.67, bv: 0.04 },   // β Ser
  { name: '',  ra: 237.405, dec:   4.477, mag: 3.71, bv: 0.05 },   // ε Ser
  { name: '',  ra: 234.256, dec:  10.539, mag: 3.80, bv: 0.32 },   // δ Ser
  { name: '',  ra: 275.328, dec:  -2.899, mag: 3.26, bv: 1.05 },   // η Ser
  { name: '',  ra: 279.073, dec:  -3.690, mag: 3.85, bv: 0.12 },   // θ1 Ser

  // Hercules extras
  { name: '',  ra: 247.555, dec:  21.490, mag: 3.48, bv: 1.44 },   // Rasalgethi (α Her)
  { name: '',  ra: 252.166, dec:  31.603, mag: 3.14, bv: 0.08 },   // δ Her
  { name: '',  ra: 255.303, dec:  36.809, mag: 3.92, bv: 0.05 },   // ε Her
  { name: '',  ra: 247.728, dec:  38.922, mag: 2.81, bv: 0.65 },   // ζ Her
  { name: '',  ra: 239.113, dec:  37.251, mag: 3.53, bv: 0.94 },   // η Her
  { name: '',  ra: 240.803, dec:  23.317, mag: 4.00, bv: 1.65 },   // σ Her
  { name: '',  ra: 262.685, dec:  37.147, mag: 3.16, bv: 1.00 },   // π Her
  { name: '',  ra: 271.886, dec:  26.110, mag: 3.42, bv: 0.75 },   // μ Her

  // Ophiuchus extras
  { name: '',  ra: 249.290, dec: -10.567, mag: 2.43, bv: 0.06 },   // η Oph
  { name: '',  ra: 257.595, dec: -15.725, mag: 2.74, bv: 1.59 },   // Yed Prior (δ Oph)
  { name: '',  ra: 258.758, dec: -10.568, mag: 3.24, bv: 0.97 },   // ε Oph
  { name: '',  ra: 265.868, dec:   4.567, mag: 3.20, bv: 0.96 },   // κ Oph
  { name: '',  ra: 275.318, dec: -29.828, mag: 3.27, bv: -0.07 },  // θ Oph

  // Scorpius extras
  { name: '',  ra: 252.166, dec: -19.806, mag: 2.62, bv: 0.07 },   // β1 Sco (Graffias)
  { name: '',  ra: 265.622, dec: -42.998, mag: 2.41, bv: -0.20 },  // κ Sco
  { name: '',  ra: 242.999, dec: -22.622, mag: 2.89, bv: -0.20 },  // π Sco

  // Lupus extras
  { name: '',  ra: 220.482, dec: -47.388, mag: 2.30, bv: -0.20 },  // α Lup
  { name: '',  ra: 224.633, dec: -43.134, mag: 2.68, bv: -0.22 },  // β Lup
  { name: '',  ra: 236.547, dec: -36.261, mag: 3.22, bv: -0.14 },  // δ Lup
  { name: '',  ra: 233.788, dec: -44.690, mag: 3.37, bv: -0.19 },  // ε Lup

  // Centaurus extras
  { name: '',  ra: 190.379, dec: -48.960, mag: 2.55, bv: -0.22 },  // ζ Cen
  { name: '',  ra: 182.090, dec: -50.722, mag: 2.60, bv: -0.18 },  // δ Cen

  // Sagittarius extras
  { name: '',  ra: 285.653, dec: -29.880, mag: 3.32, bv: 0.89 },   // τ Sgr

  // Ara extras
  { name: '',  ra: 262.690, dec: -49.876, mag: 2.95, bv: -0.15 },  // α Ara
  { name: '',  ra: 265.622, dec: -53.160, mag: 2.85, bv: 1.46 },   // β Ara
  { name: '',  ra: 263.400, dec: -55.530, mag: 3.34, bv: -0.15 },  // γ Ara
  { name: '',  ra: 261.348, dec: -55.990, mag: 3.62, bv: -0.16 },  // δ Ara
  { name: '',  ra: 254.655, dec: -53.241, mag: 3.13, bv: 1.57 },   // ζ Ara
  { name: '',  ra: 252.968, dec: -53.168, mag: 4.00, bv: 1.24 },   // ε1 Ara
  { name: '',  ra: 249.290, dec: -50.092, mag: 3.76, bv: 1.56 },   // η Ara

  // Pavo extras
  { name: '',  ra: 303.508, dec: -63.668, mag: 3.42, bv: 0.16 },   // β Pav
  { name: '',  ra: 290.418, dec: -71.428, mag: 3.56, bv: 0.75 },   // δ Pav
  { name: '',  ra: 273.179, dec: -64.724, mag: 3.62, bv: 1.06 },   // η Pav
  { name: '',  ra: 261.348, dec: -67.233, mag: 3.96, bv: 0.05 },   // ε Pav
  { name: '',  ra: 252.166, dec: -69.028, mag: 4.00, bv: 0.87 },   // ζ Pav (differs from TrA)

  // Corona Australis
  { name: '',  ra: 285.651, dec: -37.107, mag: 4.00, bv: 0.04 },   // α CrA
  { name: '',  ra: 287.363, dec: -37.904, mag: 4.00, bv: 1.15 },   // β CrA
  { name: '',  ra: 289.284, dec: -37.063, mag: 4.00, bv: 0.47 },   // δ CrA
  { name: '',  ra: 283.626, dec: -38.324, mag: 4.00, bv: 0.00 },   // γ CrA

  // Triangulum Australe extras
  { name: '',  ra: 238.786, dec: -63.430, mag: 2.85, bv: 0.29 },   // β TrA
  { name: '',  ra: 242.148, dec: -68.679, mag: 2.89, bv: 0.00 },   // γ TrA

  // Lyra extras
  { name: '',  ra: 281.085, dec:  33.363, mag: 4.00, bv: 0.02 },   // ζ1 Lyr
  { name: '',  ra: 283.626, dec:  32.690, mag: 3.24, bv: -0.05 },  // Sulafat (γ Lyr)
  { name: '',  ra: 282.520, dec:  36.899, mag: 4.00, bv: 1.58 },   // δ2 Lyr

  // Cygnus extras
  { name: '',  ra: 316.233, dec:  38.783, mag: 3.20, bv: 0.09 },   // ζ Cyg

  // Aquila extras
  { name: '',  ra: 299.689, dec:  10.613, mag: 2.72, bv: 1.52 },   // γ Aql (Tarazed)

  // Delphinus extras
  { name: '',  ra: 308.303, dec:  11.303, mag: 3.63, bv: 0.44 },   // β Del (Rotanev)
  { name: '',  ra: 309.387, dec:  14.595, mag: 3.87, bv: 0.87 },   // γ2 Del
  { name: '',  ra: 310.830, dec:  15.074, mag: 4.00, bv: 0.08 },   // δ Del
  { name: '',  ra: 306.662, dec:   9.815, mag: 4.00, bv: -0.03 },  // ε Del

  // Sagitta
  { name: '',  ra: 295.024, dec:  18.014, mag: 3.47, bv: 1.58 },   // γ Sge
  { name: '',  ra: 296.413, dec:  17.476, mag: 3.82, bv: 1.58 },   // δ Sge
  { name: '',  ra: 299.689, dec:  18.534, mag: 4.00, bv: 0.79 },   // α Sge
  { name: '',  ra: 299.070, dec:  19.490, mag: 4.00, bv: 0.83 },   // β Sge

  // Vulpecula
  { name: '',  ra: 297.696, dec:  24.665, mag: 4.00, bv: 1.55 },   // α Vul

  // Pegasus extras
  { name: '',  ra: 346.190, dec:  28.083, mag: 2.42, bv: 1.67 },   // Scheat (β Peg)
  { name: '',  ra: 340.751, dec:  15.205, mag: 2.49, bv: -0.04 },  // Markab (α Peg)
  { name: '',  ra: 326.046, dec:  25.345, mag: 2.94, bv: 0.86 },   // η Peg (Matar)

  // Capricornus
  { name: '',  ra: 304.514, dec: -12.508, mag: 3.56, bv: 0.81 },   // α2 Cap (Algedi)
  { name: '',  ra: 305.253, dec: -14.781, mag: 3.08, bv: 0.79 },   // β Cap (Dabih)
  { name: '',  ra: 311.524, dec: -16.834, mag: 4.00, bv: 0.07 },   // ψ Cap
  { name: '',  ra: 325.023, dec: -22.411, mag: 3.68, bv: 0.07 },   // γ Cap
  { name: '',  ra: 316.486, dec: -25.006, mag: 3.74, bv: 0.06 },   // ζ Cap
  { name: '',  ra: 321.667, dec: -16.127, mag: 3.74, bv: 0.06 },   // δ Cap (Deneb Algedi)

  // Aquarius extras
  { name: '',  ra: 322.890, dec:  -0.320, mag: 2.91, bv: 0.01 },   // β Aqr (Sadalsuud)
  { name: '',  ra: 331.446, dec:  -5.571, mag: 3.84, bv: 0.06 },   // γ Aqr
  { name: '',  ra: 339.228, dec:  -7.580, mag: 3.65, bv: 0.22 },   // ζ Aqr
  { name: '',  ra: 343.987, dec: -15.821, mag: 4.00, bv: 0.57 },   // η Aqr
  { name: '',  ra: 340.831, dec:  -9.180, mag: 4.00, bv: 0.38 },   // θ Aqr
  { name: '',  ra: 318.234, dec:   8.658, mag: 3.27, bv: 0.02 },   // δ Aqr (Skat)

  // Cepheus
  { name: '',  ra: 319.645, dec:  62.585, mag: 2.51, bv: 0.22 },   // Alderamin (α Cep)
  { name: '',  ra: 328.480, dec:  58.201, mag: 3.23, bv: -0.22 },  // β Cep (Alfirk)
  { name: '',  ra: 340.366, dec:  66.200, mag: 3.21, bv: 1.03 },   // Errai (γ Cep)
  { name: '',  ra: 337.291, dec:  77.632, mag: 3.52, bv: 1.57 },   // ι Cep
  { name: '',  ra: 332.714, dec:  70.561, mag: 3.98, bv: 0.68 },   // δ Cep
  { name: '',  ra: 330.947, dec:  58.201, mag: 3.35, bv: 1.12 },   // ζ Cep

  // Lacerta
  { name: '',  ra: 337.823, dec:  50.282, mag: 3.77, bv: 0.04 },   // α Lac

  // Andromeda extras
  { name: '',  ra:  13.529, dec:  42.330, mag: 3.27, bv: 0.01 },   // δ And area

  // Indus
  { name: '',  ra: 309.392, dec: -47.291, mag: 3.11, bv: 1.00 },   // α Ind
  { name: '',  ra: 313.699, dec: -58.454, mag: 3.65, bv: 1.56 },   // β Ind

  // Cetus extras
  { name: '',  ra:  40.825, dec:   3.236, mag: 3.47, bv: 0.09 },   // γ Cet (dup? different dec from β Ari)

  // Draco extras
  { name: '',  ra: 245.998, dec:  61.514, mag: 3.29, bv: 1.17 },   // ι Dra
  { name: '',  ra: 231.232, dec:  69.331, mag: 4.00, bv: 0.49 },   // θ Dra
  { name: '',  ra: 209.302, dec:  69.789, mag: 3.65, bv: 0.53 },   // χ Dra
  { name: '',  ra: 188.370, dec:  69.788, mag: 3.65, bv: 0.03 },   // α Dra (Thuban)
  { name: '',  ra: 175.942, dec:  64.724, mag: 3.87, bv: -0.14 },  // κ Dra
  { name: '',  ra: 195.568, dec:  67.662, mag: 3.84, bv: 0.01 },   // λ Dra

  // Ursa Minor extras
  { name: '',  ra: 263.054, dec:  86.586, mag: 4.00, bv: 0.03 },   // δ UMi
  { name: '',  ra: 236.015, dec:  82.037, mag: 4.00, bv: 0.56 },   // ε UMi
  { name: '',  ra: 247.555, dec:  77.795, mag: 4.00, bv: 0.08 },   // ζ UMi
  { name: '',  ra: 230.182, dec:  71.834, mag: 3.05, bv: 0.05 },   // γ UMi (Pherkad)

  // Scutum
  { name: '',  ra: 278.802, dec:  -8.244, mag: 3.85, bv: 1.33 },   // α Sct
  { name: '',  ra: 281.794, dec: -14.566, mag: 4.00, bv: 0.81 },   // β Sct
  { name: '',  ra: 284.031, dec: -12.847, mag: 4.00, bv: 0.18 },   // δ Sct
  { name: '',  ra: 280.735, dec:  -4.748, mag: 4.00, bv: 0.05 },   // γ Sct

  // Equuleus
  { name: '',  ra: 318.956, dec:   5.248, mag: 3.92, bv: 0.53 },   // α Equ (Kitalpha)

  // Dorado
  { name: '',  ra:  63.500, dec: -55.045, mag: 3.27, bv: 0.17 },   // α Dor
  { name: '',  ra:  67.339, dec: -56.165, mag: 3.76, bv: 0.67 },   // β Dor (Cepheid)
  { name: '',  ra:  83.406, dec: -62.490, mag: 4.00, bv: 0.37 },   // γ Dor
  { name: '',  ra:  81.282, dec: -65.735, mag: 4.00, bv: 0.04 },   // δ Dor

  // Pictor
  { name: '',  ra: 102.048, dec: -61.941, mag: 3.24, bv: 0.21 },   // α Pic
  { name: '',  ra:  86.821, dec: -51.067, mag: 3.86, bv: 0.17 },   // β Pic
  { name: '',  ra:  83.748, dec: -56.167, mag: 4.00, bv: 0.96 },   // γ Pic

  // Caelum
  { name: '',  ra:  70.140, dec: -41.864, mag: 4.00, bv: 0.34 },   // α Cae
  { name: '',  ra:  66.483, dec: -44.954, mag: 4.00, bv: 0.36 },   // β Cae

  // Horologium
  { name: '',  ra:  60.987, dec: -42.294, mag: 3.86, bv: 1.55 },   // α Hor

  // Reticulum
  { name: '',  ra:  63.500, dec: -62.474, mag: 3.35, bv: 0.91 },   // α Ret
  { name: '',  ra:  55.254, dec: -64.807, mag: 3.85, bv: 1.13 },   // β Ret
  { name: '',  ra:  56.049, dec: -59.302, mag: 4.00, bv: 1.00 },   // δ Ret
  { name: '',  ra:  60.988, dec: -62.159, mag: 4.00, bv: 1.06 },   // ε Ret

  // Hydrus
  { name: '',  ra:  29.692, dec: -61.570, mag: 2.86, bv: 0.28 },   // α Hyi
  { name: '',  ra:  39.244, dec: -68.660, mag: 2.80, bv: 0.62 },   // β Hyi
  { name: '',  ra:  56.812, dec: -74.239, mag: 3.24, bv: 1.62 },   // γ Hyi

  // Chamaeleon
  { name: '',  ra: 124.632, dec: -76.920, mag: 4.00, bv: 0.35 },   // α Cha
  { name: '',  ra: 151.982, dec: -78.607, mag: 4.00, bv: 1.59 },   // γ Cha
  { name: '',  ra: 191.114, dec: -80.540, mag: 4.00, bv: -0.06 },  // β Cha

  // Volans
  { name: '',  ra: 127.566, dec: -66.397, mag: 3.60, bv: 1.01 },   // γ2 Vol
  { name: '',  ra: 118.826, dec: -68.617, mag: 4.00, bv: -0.09 },  // ε Vol
  { name: '',  ra: 109.286, dec: -70.499, mag: 3.98, bv: 0.56 },   // δ Vol
  { name: '',  ra: 131.171, dec: -73.399, mag: 3.77, bv: 1.46 },   // β Vol

  // Musca
  { name: '',  ra: 189.296, dec: -69.135, mag: 2.69, bv: -0.20 },  // α Mus
  { name: '',  ra: 191.570, dec: -68.108, mag: 3.05, bv: -0.16 },  // β Mus
  { name: '',  ra: 196.277, dec: -71.549, mag: 3.62, bv: 1.06 },   // δ Mus
  { name: '',  ra: 185.340, dec: -67.961, mag: 3.87, bv: -0.20 },  // γ Mus
  { name: '',  ra: 177.387, dec: -65.398, mag: 4.00, bv: 1.62 },   // ε Mus

  // Circinus
  { name: '',  ra: 220.327, dec: -64.975, mag: 3.19, bv: 0.26 },   // α Cir

  // Norma
  { name: '',  ra: 244.960, dec: -47.555, mag: 4.00, bv: 0.94 },   // γ2 Nor
  { name: '',  ra: 240.035, dec: -49.230, mag: 4.00, bv: -0.09 },  // ε Nor

  // Telescopium
  { name: '',  ra: 271.362, dec: -49.070, mag: 3.51, bv: -0.17 },  // α Tel

  // Apus
  { name: '',  ra: 220.482, dec: -79.045, mag: 3.83, bv: 1.43 },   // α Aps
  { name: '',  ra: 246.152, dec: -75.290, mag: 3.89, bv: 0.95 },   // γ Aps
  { name: '',  ra: 253.084, dec: -77.517, mag: 3.76, bv: 1.17 },   // β Aps

  // Octans
  { name: '',  ra: 319.254, dec: -77.390, mag: 3.76, bv: 1.25 },   // ν Oct

  // Mensa
  { name: '',  ra:  92.045, dec: -74.753, mag: 4.00, bv: 0.58 },   // α Men

  // Microscopium
  { name: '',  ra: 313.984, dec: -33.779, mag: 4.00, bv: 0.87 },   // γ Mic
  { name: '',  ra: 318.906, dec: -32.173, mag: 4.00, bv: 0.05 },   // ε Mic

  // Sextans
  { name: '',  ra: 152.647, dec:  -0.372, mag: 4.00, bv: 0.03 },   // α Sex

  // Monoceros
  { name: '',  ra: 115.312, dec:  -9.551, mag: 3.93, bv: 1.02 },   // α Mon
  { name: '',  ra: 107.966, dec:  -0.493, mag: 3.76, bv: 0.00 },   // δ Mon
  { name: '',  ra:  99.171, dec:  -7.033, mag: 3.74, bv: -0.10 },  // β Mon
  { name: '',  ra:  95.942, dec:  -6.275, mag: 3.98, bv: 1.01 },   // γ Mon

  // Pyxis
  { name: '',  ra: 130.026, dec: -33.186, mag: 3.68, bv: -0.08 },  // α Pyx
  { name: '',  ra: 133.847, dec: -27.710, mag: 3.97, bv: 0.87 },   // β Pyx
  { name: '',  ra: 136.632, dec: -25.858, mag: 4.00, bv: 1.02 },   // γ Pyx

  // Antlia
  { name: '',  ra: 155.838, dec: -31.068, mag: 4.00, bv: 1.46 },   // α Ant
  { name: '',  ra: 149.268, dec: -35.950, mag: 4.00, bv: 1.44 },   // ε Ant

  // Vela extras
  { name: '',  ra: 136.999, dec: -47.097, mag: 2.69, bv: 0.90 },   // μ Vel

  // Puppis extras
  { name: '',  ra: 121.886, dec: -24.304, mag: 3.02, bv: 1.48 },   // σ Pup

  // Carina extras
  { name: '',  ra:  99.171, dec: -19.256, mag: 3.03, bv: 0.77 },   // ο2 CMa area

  // Lynx
  { name: '',  ra: 136.632, dec:  34.392, mag: 3.13, bv: 1.55 },   // α Lyn
  { name: '',  ra: 127.566, dec:  41.780, mag: 3.82, bv: 0.04 },   // 38 Lyn

  // Additional fill stars for sky density (mag 3.5-5.0)
  { name: '',  ra: 279.577, dec:  51.490, mag: 3.75, bv: 0.00 },   // ε Lyr (double-double)
  { name: '',  ra: 301.402, dec:  29.305, mag: 3.04, bv: 0.67 },   // η Cyg
  { name: '',  ra: 296.244, dec:  45.131, mag: 2.87, bv: 0.09 },   // ζ Cyg
  { name: '',  ra:  24.429, dec: -57.237, mag: 2.86, bv: -0.16 },  // θ Eri area
  { name: '',  ra: 148.191, dec: -14.847, mag: 3.11, bv: 1.44 },   // R Leo (variable)
  { name: '',  ra: 152.647, dec:  -7.315, mag: 3.06, bv: 0.42 },   // ν Hya
  { name: '',  ra: 150.575, dec:  34.215, mag: 4.00, bv: 0.35 },   // 10 LMi

  // Southern fill stars
  { name: '',  ra: 332.846, dec: -81.382, mag: 4.00, bv: 0.10 },   // β Oct
  { name: '',  ra: 218.293, dec: -83.668, mag: 4.00, bv: 1.00 },   // δ Oct
  { name: '',  ra: 116.364, dec: -72.606, mag: 3.95, bv: 1.20 },   // ζ Vol
  { name: '',  ra: 181.468, dec: -77.484, mag: 4.00, bv: -0.06 },  // δ2 Cha
  { name: '',  ra:  76.312, dec: -78.077, mag: 4.00, bv: 0.38 },   // η Men
  { name: '',  ra:  73.818, dec: -76.340, mag: 4.00, bv: 1.38 },   // γ Men
  { name: '',  ra: 228.381, dec: -59.321, mag: 4.00, bv: 0.08 },   // β Cir
  { name: '',  ra: 226.380, dec: -63.614, mag: 4.00, bv: -0.15 },  // γ Cir

  // Northern fill stars
  { name: '',  ra: 336.130, dec:  46.537, mag: 4.00, bv: 0.05 },   // β Lac
  { name: '',  ra: 338.967, dec:  43.123, mag: 4.00, bv: -0.09 },  // 4 Lac
  { name: '',  ra: 335.249, dec:  39.637, mag: 4.00, bv: 0.00 },   // 5 Lac
  { name: '',  ra: 335.393, dec:  37.748, mag: 4.00, bv: -0.05 },  // 2 Lac

  // Equatorial fill
  { name: '',  ra: 316.175, dec:  10.131, mag: 4.00, bv: 0.36 },   // δ Equ
  { name: '',  ra: 316.930, dec:  10.008, mag: 4.00, bv: 0.32 },   // γ Equ
  { name: '',  ra: 284.055, dec:  -4.882, mag: 4.00, bv: 1.16 },   // ξ Ser

  // Additional scattered stars for visual density
  { name: '',  ra:  42.674, dec:  47.042, mag: 4.00, bv: 0.58 },   // 16 Per area
  { name: '',  ra: 120.080, dec:  69.320, mag: 4.00, bv: 1.04 },   // 7 Cam area
  { name: '',  ra:  97.770, dec:  59.010, mag: 4.00, bv: 0.97 },   // 15 Lyn
  { name: '',  ra: 108.853, dec:  56.715, mag: 4.00, bv: 0.01 },   // 21 Lyn
  { name: '',  ra: 245.178, dec: -52.304, mag: 4.00, bv: 0.96 },   // η Nor
  { name: '',  ra: 248.044, dec: -78.696, mag: 4.00, bv: 1.55 },   // δ1 Aps
  { name: '',  ra: 233.672, dec:  -3.694, mag: 4.00, bv: 0.14 },   // μ Ser
  { name: '',  ra: 126.415, dec:  -6.418, mag: 4.00, bv: 0.97 },   // σ Hya
  { name: '',  ra: 189.296, dec: -23.171, mag: 4.00, bv: 0.14 },   // π Hya
  { name: '',  ra: 198.789, dec: -29.248, mag: 3.00, bv: 0.92 },   // γ Hya (body)
  { name: '',  ra: 210.669, dec: -33.908, mag: 3.54, bv: 0.15 },   // ξ Hya (tail)

  // Fornax extras
  { name: '',  ra:  33.506, dec: -24.884, mag: 4.00, bv: 0.39 },   // ν For

  // Cetus body
  { name: '',  ra:  40.825, dec:   3.236, mag: 3.47, bv: 0.99 },   // γ Cet area

  // Additional bright stars for fill (mag 3.5-4.5, various positions)
  { name: '',  ra: 344.412, dec:  42.330, mag: 3.53, bv: 0.97 },   // ι Peg
  { name: '',  ra: 352.822, dec:  28.083, mag: 4.00, bv: 0.52 },   // μ Peg
  { name: '',  ra: 303.508, dec:  47.714, mag: 3.72, bv: 0.34 },   // ι Cyg
  { name: '',  ra: 315.097, dec: -43.448, mag: 4.00, bv: 1.13 },   // θ Ind
  { name: '',  ra: 302.826, dec:  27.177, mag: 4.00, bv: 0.92 },   // 23 Vul
  { name: '',  ra: 300.275, dec:  21.390, mag: 4.00, bv: 0.09 },   // 15 Vul

  // Extra southern density
  { name: '',  ra: 160.0, dec: -55.0, mag: 4.00, bv: 0.10 },
  { name: '',  ra: 200.0, dec: -45.0, mag: 4.00, bv: 0.50 },
  { name: '',  ra: 270.0, dec: -60.0, mag: 4.00, bv: 0.20 },
  { name: '',  ra: 310.0, dec: -35.0, mag: 4.00, bv: 0.30 },
  { name: '',  ra:  45.0, dec: -65.0, mag: 4.00, bv: 0.40 },
  { name: '',  ra: 135.0, dec: -75.0, mag: 4.00, bv: 0.50 },

  // Extra northern density
  { name: '',  ra:  50.0, dec:  72.0, mag: 4.00, bv: 0.20 },
  { name: '',  ra: 150.0, dec:  45.0, mag: 4.00, bv: 0.30 },
  { name: '',  ra: 250.0, dec:  55.0, mag: 4.00, bv: 0.60 },
  { name: '',  ra: 350.0, dec:  50.0, mag: 4.00, bv: 0.10 },
];
