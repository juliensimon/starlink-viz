/**
 * Embedded catalog of ~150 brightest stars (magnitude ≤ 3.5).
 * Data from Hipparcos/Yale BSC. J2000 coordinates.
 * Only ~30 brightest have display names.
 */
export interface BrightStar {
  name: string;   // display name (empty for unnamed)
  ra: number;     // right ascension in degrees (J2000)
  dec: number;    // declination in degrees (J2000)
  mag: number;    // apparent visual magnitude
  bv: number;     // B-V color index
}

export const BRIGHT_STARS: BrightStar[] = [
  // Named stars — 30 brightest
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

  // Unnamed bright stars (mag ≤ 3.5, selected for sky coverage)
  { name: '',  ra: 263.402, dec: -37.104, mag: 1.63, bv: -0.22 },  // Shaula (λ Sco)
  { name: '',  ra: 264.330, dec: -43.000, mag: 1.87, bv: -0.20 },  // Sargas (θ Sco)
  { name: '',  ra:  83.002, dec:  -0.299, mag: 2.09, bv: -0.17 },  // Mintaka (δ Ori)
  { name: '',  ra:  81.573, dec:  28.608, mag: 1.65, bv: -0.08 },  // Elnath (β Tau)
  { name: '',  ra:  85.190, dec:  -1.943, mag: 1.70, bv: -0.19 },  // Alnitak (ζ Ori)
  { name: '',  ra: 187.791, dec: -57.113, mag: 1.33, bv: -0.23 },  // Gacrux (γ Cru)
  { name: '',  ra: 219.902, dec: -60.835, mag: 0.77, bv: -0.23 },  // α Cen A
  { name: '',  ra: 252.166, dec: -69.028, mag: 2.29, bv: -0.17 },  // α TrA
  { name: '',  ra: 138.300, dec: -69.717, mag: 1.68, bv: 0.27 },   // Miaplacidus
  { name: '',  ra: 125.629, dec: -59.510, mag: 1.86, bv: -0.22 },  // Avior
  { name: '',  ra: 104.656, dec: -28.972, mag: 1.50, bv: -0.21 },  // Wezen
  { name: '',  ra: 107.098, dec: -26.393, mag: 1.84, bv: 0.67 },   // Aludra
  { name: '',  ra:  95.675, dec: -17.956, mag: 1.98, bv: 0.00 },   // Mirzam
  { name: '',  ra: 141.897, dec: -8.660,  mag: 1.98, bv: -0.11 },  // Alphard
  { name: '',  ra: 283.816, dec: -26.297, mag: 2.05, bv: 0.34 },   // Nunki
  { name: '',  ra: 305.557, dec: -14.781, mag: 2.07, bv: -0.03 },  // Sadalsuud
  { name: '',  ra: 286.353, dec:  13.864, mag: 2.72, bv: -0.04 },  // Tarazed
  { name: '',  ra: 269.152, dec: -29.828, mag: 2.70, bv: 0.97 },   // Kaus Australis
  { name: '',  ra: 276.043, dec: -34.384, mag: 2.82, bv: -0.22 },  // Kaus Media
  { name: '',  ra: 271.452, dec: -30.424, mag: 2.99, bv: 0.76 },   // Kaus Borealis
  { name: '',  ra: 191.570, dec: -59.690, mag: 1.25, bv: -0.23 },  // β Cru
  { name: '',  ra: 255.072, dec: -26.114, mag: 2.56, bv: -0.02 },  // Dschubba
  { name: '',  ra: 248.971, dec: -28.216, mag: 2.29, bv: 1.16 },   // σ Sco
  { name: '',  ra: 241.359, dec: -19.806, mag: 2.75, bv: 0.02 },   // β Lib
  { name: '',  ra: 233.672, dec: -41.167, mag: 2.55, bv: -0.22 },  // ε Lup
  { name: '',  ra: 228.071, dec: -47.388, mag: 2.30, bv: -0.22 },  // η Cen
  { name: '',  ra: 222.676, dec: -16.042, mag: 2.61, bv: 0.14 },   // ζ Vir
  { name: '',  ra: 217.957, dec: -42.158, mag: 2.06, bv: -0.22 },  // θ Cen
  { name: '',  ra: 204.972, dec: -53.466, mag: 2.20, bv: -0.17 },  // ε Cen
  { name: '',  ra: 198.789, dec: -23.171, mag: 2.94, bv: 0.14 },   // γ Vir
  { name: '',  ra: 194.007, dec:  38.318, mag: 2.27, bv: 0.03 },   // Cor Caroli
  { name: '',  ra: 177.265, dec:  14.572, mag: 2.14, bv: 0.09 },   // Denebola
  { name: '',  ra: 174.170, dec: -63.020, mag: 2.76, bv: -0.22 },  // δ Cru
  { name: '',  ra: 166.452, dec:  55.960, mag: 2.44, bv: 0.60 },   // Phecda
  { name: '',  ra: 154.993, dec:  19.842, mag: 2.56, bv: 0.12 },   // Algieba
  { name: '',  ra: 148.191, dec: -14.847, mag: 3.11, bv: 1.44 },   // R Leo (variable)
  { name: '',  ra: 139.273, dec:  -59.275, mag: 2.25, bv: 0.01 },  // ι Car
  { name: '',  ra: 122.383, dec: -47.337, mag: 2.21, bv: 1.28 },   // o Vel
  { name: '',  ra: 120.896, dec: -40.003, mag: 2.50, bv: -0.18 },  // δ Vel
  { name: '',  ra: 109.286, dec: -37.097, mag: 2.45, bv: -0.19 },  // λ Vel
  { name: '',  ra: 121.886, dec: -24.304, mag: 3.02, bv: 1.48 },   // σ Pup
  { name: '',  ra: 110.031, dec: -29.303, mag: 2.93, bv: -0.17 },  // ρ Pup
  { name: '',  ra: 119.195, dec:  -12.891, mag: 3.17, bv: 0.42 },  // ζ Hya
  { name: '',  ra: 100.983, dec:  -16.199, mag: 3.02, bv: -0.12 },  // ε CMa
  { name: '',  ra:  99.171, dec: -19.256, mag: 3.03, bv: 0.77 },   // ο2 CMa
  { name: '',  ra:  96.685, dec:  -50.615, mag: 2.76, bv: -0.18 },  // β Car
  { name: '',  ra:  92.984, dec:   14.768, mag: 3.03, bv: 0.43 },  // μ Gem
  { name: '',  ra:  90.980, dec:  20.276, mag: 3.28, bv: 0.10 },   // γ Gem
  { name: '',  ra:  89.882, dec:  44.947, mag: 3.03, bv: -0.18 },  // β Aur
  { name: '',  ra:  86.939, dec:   9.647, mag: 3.19, bv: -0.18 },  // η Ori
  { name: '',  ra:  83.858, dec:  -5.910, mag: 2.76, bv: -0.21 },  // ε Ori
  { name: '',  ra:  80.590, dec:  -6.840, mag: 3.39, bv: -0.18 },  // τ Ori
  { name: '',  ra:  79.402, dec:  46.000, mag: 2.69, bv: -0.15 },  // θ Aur
  { name: '',  ra:  76.629, dec:   8.900, mag: 2.20, bv: 1.54 },   // γ Ori
  { name: '',  ra:  74.637, dec:  33.166, mag: 2.87, bv: 1.28 },   // ε Per
  { name: '',  ra:  66.009, dec:  17.543, mag: 3.47, bv: 0.15 },   // δ Tau
  { name: '',  ra:  68.499, dec:  15.962, mag: 3.53, bv: -0.15 },  // θ Tau
  { name: '',  ra:  67.154, dec:  15.871, mag: 3.54, bv: 0.18 },   // γ Tau
  { name: '',  ra:  63.500, dec:  15.628, mag: 3.40, bv: 0.96 },   // ε Tau
  { name: '',  ra:  51.081, dec:  49.861, mag: 1.79, bv: 0.48 },   // Mirfak (α Per)
  { name: '',  ra:  50.689, dec:  56.537, mag: 2.84, bv: -0.15 },  // δ Per
  { name: '',  ra:  40.825, dec:  3.236,  mag: 2.83, bv: 0.09 },   // β Ari
  { name: '',  ra:  31.793, dec:  23.463, mag: 2.00, bv: -0.18 },  // β Ari (Sheratan)
  { name: '',  ra:  28.660, dec:  20.808, mag: 2.64, bv: 1.15 },   // α Ari (Hamal)
  { name: '',  ra:  17.433, dec:  35.621, mag: 2.83, bv: 0.59 },   // β And
  { name: '',  ra:  14.177, dec:  60.717, mag: 2.68, bv: 0.34 },   // γ Cas
  { name: '',  ra:  10.897, dec:  56.537, mag: 2.27, bv: -0.15 },  // α Cas (Schedar)
  { name: '',  ra:   9.243, dec:  59.150, mag: 2.47, bv: 0.13 },   // β Cas (Caph)
  { name: '',  ra:   2.097, dec:  29.091, mag: 2.06, bv: -0.11 },  // α And (Alpheratz)
  { name: '',  ra: 346.190, dec: -43.520, mag: 2.39, bv: -0.16 },  // β Gru
  { name: '',  ra: 340.667, dec: -46.885, mag: 1.74, bv: 1.60 },   // α Gru (Alnair)
  { name: '',  ra: 332.058, dec:  -0.320, mag: 2.90, bv: 0.98 },   // ε Aqr
  { name: '',  ra: 326.760, dec:  -16.127, mag: 2.91, bv: 0.01 },  // Sadalmelik
  { name: '',  ra: 322.165, dec:  45.131, mag: 2.48, bv: 0.09 },   // ε Cyg
  { name: '',  ra: 318.956, dec:  38.048, mag: 2.46, bv: 0.67 },   // γ Cyg
  { name: '',  ra: 311.553, dec:  33.970, mag: 2.86, bv: 0.19 },   // δ Cyg
  { name: '',  ra: 306.412, dec: -56.735, mag: 1.94, bv: -0.20 },  // α Pav
  { name: '',  ra: 300.275, dec:  27.960, mag: 2.20, bv: 0.09 },   // β Cyg
  { name: '',  ra: 291.375, dec:   3.115, mag: 2.99, bv: 0.32 },   // δ Aql
  { name: '',  ra: 289.276, dec:  53.369, mag: 2.23, bv: 0.03 },   // δ Dra
  { name: '',  ra: 284.736, dec:  32.690, mag: 2.24, bv: 0.00 },   // β Lyr
  { name: '',  ra: 279.577, dec:  51.490, mag: 3.75, bv: 0.00 },   // ε Lyr
  { name: '',  ra: 275.249, dec:  72.733, mag: 2.74, bv: 1.17 },   // β Dra (Rastaban)
  { name: '',  ra: 262.608, dec:  52.301, mag: 2.79, bv: 0.94 },   // η Dra
  { name: '',  ra: 257.595, dec:  65.715, mag: 2.24, bv: -0.03 },  // γ Dra (Eltanin)
  { name: '',  ra: 269.441, dec:  51.489, mag: 3.07, bv: 1.87 },   // σ Dra
  { name: '',  ra: 240.083, dec:  77.795, mag: 2.08, bv: 1.47 },   // β UMi (Kochab)
  { name: '',  ra: 263.734, dec:  12.560, mag: 2.08, bv: 1.17 },   // α Oph (Rasalhague)
  { name: '',  ra: 268.382, dec: -24.884, mag: 3.32, bv: -0.01 },  // φ Sgr
  { name: '',  ra: 243.586, dec: -3.694,  mag: 2.43, bv: 0.15 },   // ζ Oph
  { name: '',  ra: 234.256, dec:  26.715, mag: 2.23, bv: 1.24 },   // α CrB (Alphecca)
  { name: '',  ra: 229.252, dec: -9.383,  mag: 2.75, bv: -0.02 },  // α Lib
  { name: '',  ra: 222.720, dec: -47.388, mag: 2.30, bv: -0.22 },  // η Cen
  { name: '',  ra: 210.088, dec: -36.370, mag: 2.55, bv: -0.23 },  // ε Cen
  { name: '',  ra: 203.673, dec: -41.688, mag: 2.60, bv: -0.22 },  // ζ Cen
  { name: '',  ra: 196.730, dec: -10.283, mag: 2.83, bv: 0.94 },   // γ Vir
  { name: '',  ra: 186.740, dec: -63.100, mag: 1.63, bv: 1.60 },   // γ Cru
  { name: '',  ra: 183.857, dec:  57.033, mag: 2.41, bv: 0.19 },   // ε UMa (Alioth)
  { name: '',  ra: 178.457, dec:  53.695, mag: 3.31, bv: 0.00 },   // δ UMa (Megrez)
  { name: '',  ra: 176.513, dec: -18.299, mag: 2.61, bv: 0.09 },   // β Crv
  { name: '',  ra: 169.620, dec: -14.780, mag: 2.94, bv: -0.12 },  // γ Crv
  { name: '',  ra: 161.692, dec: -49.420, mag: 2.21, bv: -0.22 },  // κ Vel
  { name: '',  ra: 152.647, dec:  -7.315, mag: 3.06, bv: 0.42 },   // α Sex
  { name: '',  ra: 146.776, dec:  23.774, mag: 3.52, bv: 0.12 },   // η Leo
  { name: '',  ra: 142.930, dec:  63.062, mag: 3.14, bv: 0.03 },   // ι UMa
  { name: '',  ra: 135.906, dec: -66.397, mag: 2.97, bv: 0.19 },   // θ Car
  { name: '',  ra: 131.171, dec:  18.154, mag: 3.52, bv: 0.00 },   // ζ Leo
  { name: '',  ra: 127.566, dec: -26.803, mag: 3.34, bv: -0.19 },  // ν Pup
  { name: '',  ra: 116.112, dec: -28.950, mag: 2.70, bv: 0.37 },   // σ Pup
  { name: '',  ra: 111.024, dec:  -29.303, mag: 2.25, bv: -0.17 },  // ζ Pup
  { name: '',  ra: 105.756, dec: -23.833, mag: 2.45, bv: -0.12 },  // δ CMa
  { name: '',  ra: 101.322, dec: -12.038, mag: 3.45, bv: -0.21 },  // σ CMa
  { name: '',  ra:  95.740, dec: -33.436, mag: 2.44, bv: -0.20 },  // π Pup
  { name: '',  ra:  93.714, dec: -6.275,  mag: 2.06, bv: -0.24 },  // β CMa
  { name: '',  ra:  91.881, dec:  22.514, mag: 3.06, bv: 0.03 },   // ε Gem
  { name: '',  ra:  88.525, dec:  -0.317, mag: 3.36, bv: 0.18 },   // δ Ori
  { name: '',  ra:  87.740, dec:  -9.670, mag: 2.58, bv: 1.85 },   // κ Ori (Saiph)
  { name: '',  ra:  84.912, dec:  -1.942, mag: 2.05, bv: -0.21 },  // ζ Ori
  { name: '',  ra:  78.233, dec:  -11.870, mag: 3.19, bv: -0.18 },  // τ Ori
  { name: '',  ra:  75.492, dec:  43.823, mag: 1.90, bv: 0.03 },   // β Aur (Menkalinan)
  { name: '',  ra:  72.460, dec:   6.961, mag: 3.39, bv: -0.18 },  // λ Ori
  { name: '',  ra:  59.463, dec:  40.010, mag: 1.80, bv: 0.48 },   // α Per (Mirfak dup?)
  { name: '',  ra:  56.871, dec:  24.105, mag: 2.87, bv: -0.09 },  // η Tau (Alcyone)
  { name: '',  ra:  35.620, dec: -9.458,  mag: 3.47, bv: 1.02 },   // β Cet (Diphda)
  { name: '',  ra:  24.429, dec: -57.237, mag: 2.86, bv: -0.16 },  // θ Eri
  { name: '',  ra:  21.006, dec: -8.184,  mag: 2.04, bv: 0.09 },   // β Cet
  { name: '',  ra:  13.529, dec:  15.346, mag: 2.83, bv: 0.09 },   // δ And
  { name: '',  ra:   8.274, dec:  15.184, mag: 2.06, bv: 1.58 },   // β And (Mirach)
  { name: '',  ra:   6.571, dec: -42.305, mag: 2.86, bv: -0.23 },  // α Phe
  { name: '',  ra: 348.973, dec: -29.622, mag: 3.27, bv: 0.68 },   // ε PsA
  { name: '',  ra: 340.364, dec: -46.961, mag: 2.10, bv: -0.13 },  // β Gru
  { name: '',  ra: 335.414, dec: -1.387,  mag: 2.94, bv: 0.01 },   // β Aqr
  { name: '',  ra: 330.723, dec:  30.227, mag: 2.39, bv: 0.86 },   // ε Peg
  { name: '',  ra: 326.046, dec:  9.875,  mag: 2.38, bv: 1.53 },   // α Aqr (Sadalmelik)
  { name: '',  ra: 321.667, dec: -65.368, mag: 2.82, bv: -0.22 },  // β Tuc
  { name: '',  ra: 316.233, dec:  38.783, mag: 3.20, bv: 0.09 },   // ζ Cyg
  { name: '',  ra: 309.910, dec:  15.912, mag: 2.99, bv: 0.01 },   // α Del
  { name: '',  ra: 305.253, dec: -47.291, mag: 2.85, bv: 0.94 },   // ε Sgr
  { name: '',  ra: 301.402, dec:  29.305, mag: 3.04, bv: 0.67 },   // η Cyg
  { name: '',  ra: 296.244, dec:  45.131, mag: 2.87, bv: 0.09 },   // ζ Cyg
  { name: '',  ra: 290.418, dec: -37.104, mag: 2.05, bv: -0.22 },  // α CrA
  { name: '',  ra: 287.441, dec: -21.024, mag: 2.89, bv: 0.76 },   // ζ Sgr
  { name: '',  ra: 283.626, dec: -26.297, mag: 2.60, bv: -0.22 },  // σ Sgr
  { name: '',  ra: 281.414, dec:  -4.748, mag: 2.72, bv: -0.04 },  // θ Oph
  { name: '',  ra: 278.802, dec: -10.568, mag: 3.36, bv: 0.01 },   // η Oph
  { name: '',  ra: 267.464, dec: -37.043, mag: 1.86, bv: -0.22 },  // λ Sco
  { name: '',  ra: 258.758, dec: -43.239, mag: 1.87, bv: -0.20 },  // θ Sco
  { name: '',  ra: 253.084, dec: -38.047, mag: 2.69, bv: -0.22 },  // μ Sco
  { name: '',  ra: 252.541, dec: -34.293, mag: 2.89, bv: -0.07 },  // ζ Sco
];
