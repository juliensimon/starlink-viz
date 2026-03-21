/**
 * Starlink ground station (gateway) locations.
 * Primary source: HF dataset juliensimon/starlink-ground-stations
 * Falls back to embedded FALLBACK_STATIONS if HF is unavailable.
 *
 * GROUND_STATIONS is a mutable array — refreshGroundStations() updates it
 * in-place so all consumers see new data without re-importing.
 * groundStationsVersion increments on each successful refresh.
 */

export interface GroundStation {
  name: string;
  lat: number;
  lon: number;
  /** operational = confirmed active; planned = approved/under construction */
  status?: 'operational' | 'planned';
}

// Embedded fallback — last known good data
const FALLBACK_STATIONS: GroundStation[] = [
  { name: 'Adelanto, CA', lat: 34.5828, lon: -117.409, status: 'planned' },
  { name: 'Aguadilla, PR', lat: 18.43, lon: -67.15, status: 'operational' },
  { name: 'Anchorage, AK', lat: 61.2181, lon: -149.9003, status: 'operational' },
  { name: 'Anderson, SC', lat: 34.5034, lon: -82.6501, status: 'planned' },
  { name: 'Angola, IN', lat: 41.6348, lon: -84.9994, status: 'planned' },
  { name: 'Arbuckle, CA', lat: 39.02, lon: -122.06, status: 'operational' },
  { name: 'Arlington, OR', lat: 45.7226, lon: -120.1979, status: 'planned' },
  { name: 'Arvin, CA', lat: 35.2094, lon: -118.8278, status: 'planned' },
  { name: 'Baxley, GA', lat: 31.7791, lon: -82.3485, status: 'operational' },
  { name: 'Beekmantown, NY', lat: 44.7629, lon: -73.5754, status: 'operational' },
  { name: 'Bellingham, WA', lat: 48.7519, lon: -122.4787, status: 'operational' },
  { name: 'Benkelman, NE', lat: 40.0492, lon: -101.5329, status: 'planned' },
  { name: 'Blountsville, AL', lat: 33.981, lon: -86.5914, status: 'planned' },
  { name: 'Boca Chica, TX', lat: 26.0621, lon: -97.1668, status: 'operational' },
  { name: 'Boydton, VA', lat: 36.6677, lon: -78.3875, status: 'planned' },
  { name: 'Brewster, WA', lat: 48.0962, lon: -119.7806, status: 'operational' },
  { name: 'Broadview, IL', lat: 41.8642, lon: -87.8534, status: 'operational' },
  { name: 'Brunswick, ME', lat: 43.9145, lon: -69.9653, status: 'planned' },
  { name: 'Butte, MT', lat: 46.0038, lon: -112.5348, status: 'operational' },
  { name: 'Cass County, ND', lat: 46.93, lon: -97.25, status: 'operational' },
  { name: 'Charleston, OR', lat: 43.345, lon: -124.3285, status: 'operational' },
  { name: 'Charleston, SC', lat: 32.7765, lon: -79.9311, status: 'planned' },
  { name: 'Cheyenne, WY', lat: 41.14, lon: -104.8202, status: 'planned' },
  { name: 'Clinton, IL', lat: 40.1536, lon: -88.9645, status: 'planned' },
  { name: 'Colburn, ID', lat: 48.4, lon: -116.55, status: 'operational' },
  { name: 'Columbus, OH', lat: 39.9612, lon: -82.9988, status: 'planned' },
  { name: 'Conrad, MT', lat: 48.17, lon: -111.95, status: 'operational' },
  { name: 'Des Moines, IA', lat: 41.5868, lon: -93.625, status: 'planned' },
  { name: 'Dill City, OK', lat: 35.28, lon: -99.12, status: 'operational' },
  { name: 'Dumas, TX', lat: 35.8628, lon: -101.9732, status: 'operational' },
  { name: 'Elbert, CO', lat: 39.2239, lon: -104.5347, status: 'operational' },
  { name: 'Elkton, MD', lat: 39.6068, lon: -75.8333, status: 'planned' },
  { name: 'Evanston, WY', lat: 41.2683, lon: -110.9632, status: 'operational' },
  { name: 'Fairbanks, AK', lat: 64.8378, lon: -147.7164, status: 'operational' },
  { name: 'Fort Lauderdale, FL', lat: 26.1224, lon: -80.1373, status: 'operational' },
  { name: 'Frederick, MD', lat: 39.4143, lon: -77.4105, status: 'operational' },
  { name: 'Gaffney, SC', lat: 35.0718, lon: -81.6498, status: 'operational' },
  { name: 'Greenville, PA', lat: 41.4028, lon: -80.3812, status: 'operational' },
  { name: 'Guam', lat: 13.44, lon: 144.79, status: 'operational' },
  { name: 'Hamshire, TX', lat: 29.8622, lon: -94.6749, status: 'operational' },
  { name: 'Hawthorne, CA', lat: 33.9207, lon: -118.328, status: 'operational' },
  { name: 'Hillman, MI', lat: 45.0586, lon: -83.9022, status: 'operational' },
  { name: 'Hillsboro, TX', lat: 32.011, lon: -97.13, status: 'operational' },
  { name: 'Hilo, HI', lat: 19.72, lon: -155.08, status: 'operational' },
  { name: 'Hitterdal, MN', lat: 46.9769, lon: -96.2595, status: 'operational' },
  { name: 'Inman, KS', lat: 38.2319, lon: -97.7725, status: 'operational' },
  { name: 'Kalama, WA', lat: 46.01, lon: -122.84, status: 'operational' },
  { name: 'Kenansville, FL', lat: 27.8847, lon: -81.0962, status: 'operational' },
  { name: 'Ketchikan, AK', lat: 55.342, lon: -131.636, status: 'operational' },
  { name: 'Kuparuk, AK', lat: 70.3316, lon: -149.5947, status: 'operational' },
  { name: 'Lawrence, KS', lat: 38.9717, lon: -95.2353, status: 'operational' },
  { name: 'Litchfield, CT', lat: 41.7473, lon: -73.1885, status: 'operational' },
  { name: 'Litchfield, MN', lat: 45.12, lon: -94.53, status: 'operational' },
  { name: 'Lockport, NY', lat: 43.1709, lon: -78.6903, status: 'operational' },
  { name: 'Loring, ME', lat: 46.95, lon: -67.89, status: 'operational' },
  { name: 'Lunenburg, VT', lat: 44.4643, lon: -71.682, status: 'operational' },
  { name: 'Manassas, VA', lat: 38.7509, lon: -77.4753, status: 'operational' },
  { name: 'Manistique, MI', lat: 45.9575, lon: -86.2464, status: 'operational' },
  { name: 'Marcell, MN', lat: 47.593, lon: -93.6941, status: 'operational' },
  { name: 'Marshall, TX', lat: 32.5449, lon: -94.3674, status: 'planned' },
  { name: 'McGregor, TX', lat: 31.44, lon: -97.41, status: 'operational' },
  { name: 'Merrillan, WI', lat: 44.45, lon: -90.8333, status: 'operational' },
  { name: 'Molokai, HI', lat: 21.1333, lon: -157.0167, status: 'operational' },
  { name: 'Mt. Ayr, IN', lat: 39.975, lon: -87.3036, status: 'operational' },
  { name: 'Murrieta, CA', lat: 33.5539, lon: -117.2139, status: 'planned' },
  { name: 'Nemaha, NE', lat: 40.3408, lon: -95.6708, status: 'operational' },
  { name: 'New Braunfels, TX', lat: 29.703, lon: -98.1245, status: 'operational' },
  { name: 'Nome, AK', lat: 64.5011, lon: -165.4064, status: 'operational' },
  { name: 'Norcross, GA', lat: 33.941, lon: -84.2135, status: 'operational' },
  { name: 'North Bend, OR', lat: 43.4073, lon: -124.2242, status: 'operational' },
  { name: 'North Bend, WA', lat: 47.4957, lon: -121.7868, status: 'planned' },
  { name: 'Olympia, WA', lat: 47.0379, lon: -122.9007, status: 'planned' },
  { name: 'Panaca, NV', lat: 37.8, lon: -114.39, status: 'operational' },
  { name: 'Ponce, PR', lat: 18.0111, lon: -66.6141, status: 'operational' },
  { name: 'Port Matilda, PA', lat: 40.8015, lon: -78.0489, status: 'planned' },
  { name: 'Prosser, WA', lat: 46.2068, lon: -119.7687, status: 'operational' },
  { name: 'Punta Gorda, FL', lat: 26.9298, lon: -82.0454, status: 'operational' },
  { name: 'Quincy, WA', lat: 47.2343, lon: -119.8526, status: 'planned' },
  { name: 'Redmond, WA', lat: 47.674, lon: -122.1215, status: 'operational' },
  { name: 'Richardson, TX', lat: 32.9483, lon: -96.7299, status: 'planned' },
  { name: 'Roberts, WI', lat: 44.9839, lon: -92.556, status: 'planned' },
  { name: 'Robertsdale, AL', lat: 30.55, lon: -87.71, status: 'operational' },
  { name: 'Rolesville, NC', lat: 35.93, lon: -78.46, status: 'operational' },
  { name: 'Rolette, ND', lat: 48.6597, lon: -99.8406, status: 'operational' },
  { name: 'Roll, AZ', lat: 32.8128, lon: -113.9953, status: 'operational' },
  { name: 'Romulus, NY', lat: 42.7584, lon: -76.8347, status: 'planned' },
  { name: 'San Antonio, TX', lat: 29.4241, lon: -98.4936, status: 'planned' },
  { name: 'Sanderson, TX', lat: 30.1421, lon: -102.3949, status: 'operational' },
  { name: 'Savanna, IL', lat: 42.0947, lon: -90.1543, status: 'planned' },
  { name: 'Savannah, TN', lat: 35.2245, lon: -88.2492, status: 'planned' },
  { name: 'Sheffield, IL', lat: 41.3592, lon: -89.7373, status: 'planned' },
  { name: 'Slope County, ND', lat: 46.45, lon: -103.95, status: 'operational' },
  { name: 'Springer, OK', lat: 34.2853, lon: -97.1317, status: 'operational' },
  { name: 'Sullivan, ME', lat: 44.5314, lon: -68.2022, status: 'operational' },
  { name: 'The Dalles, OR', lat: 45.5946, lon: -121.1787, status: 'planned' },
  { name: 'Tionesta, CA', lat: 41.1811, lon: -122.8747, status: 'operational' },
  { name: 'Toa Baja, PR', lat: 18.4441, lon: -66.2545, status: 'operational' },
  { name: 'Tracy City, TN', lat: 35.2595, lon: -85.7369, status: 'operational' },
  { name: 'Unalaska, AK', lat: 53.8791, lon: -166.5422, status: 'operational' },
  { name: 'Vernon, UT', lat: 40.09, lon: -112.43, status: 'operational' },
  { name: 'Warren, MO', lat: 38.7728, lon: -91.1643, status: 'operational' },
  { name: 'Wichita Falls, TX', lat: 33.9137, lon: -98.4934, status: 'planned' },
  { name: 'Wise, NC', lat: 35.2407, lon: -79.1151, status: 'operational' },
  { name: 'York, PA', lat: 39.9626, lon: -76.7277, status: 'planned' },
  { name: 'Marathon, ON', lat: 48.754, lon: -86.379, status: 'operational' },
  { name: 'Saguenay, QC', lat: 48.4279, lon: -71.0548, status: 'operational' },
  { name: 'Sambro Creek, NS', lat: 44.4833, lon: -63.6, status: 'operational' },
  { name: "St. John's, NL", lat: 47.5615, lon: -52.7126, status: 'operational' },
  { name: 'Cabo San Lucas, Mexico', lat: 22.8905, lon: -109.9167, status: 'operational' },
  { name: 'Charcas, Mexico', lat: 23.1314, lon: -101.1136, status: 'operational' },
  { name: 'El Marques, Mexico', lat: 20.7167, lon: -100.3, status: 'operational' },
  { name: 'Llano Grande, Mexico', lat: 19.34, lon: -97.008, status: 'operational' },
  { name: 'Mazahua, Mexico', lat: 19.65, lon: -100.05, status: 'operational' },
  { name: 'Merida, Mexico', lat: 20.9674, lon: -89.5926, status: 'operational' },
  { name: 'Monterrey, Mexico', lat: 25.6866, lon: -100.3161, status: 'operational' },
  { name: 'Peñuelas, Mexico', lat: 21.8422, lon: -102.3344, status: 'operational' },
  { name: 'Tapachula, Mexico', lat: 14.9032, lon: -92.2577, status: 'operational' },
  { name: 'Villahermosa, Mexico', lat: 17.9893, lon: -92.9472, status: 'operational' },
  { name: 'Caleta, DR', lat: 18.456, lon: -69.752, status: 'operational' },
  { name: 'Santiago de los Caballeros, DR', lat: 19.4517, lon: -70.697, status: 'operational' },
  { name: 'Willemstad, Curaçao', lat: 12.1696, lon: -68.99, status: 'operational' },
  { name: 'Aerzen, Germany', lat: 52.0489, lon: 9.2683, status: 'operational' },
  { name: 'Alfouvar de Cima, Portugal', lat: 40.5167, lon: -8.25, status: 'operational' },
  { name: 'Ballinspittle, Ireland', lat: 51.6508, lon: -8.5808, status: 'operational' },
  { name: 'Chalfont Grove, UK', lat: 51.6167, lon: -0.5667, status: 'operational' },
  { name: 'Covilhã, Portugal', lat: 40.2833, lon: -7.5, status: 'operational' },
  { name: 'Elfordstown, Ireland', lat: 52.0833, lon: -8.25, status: 'operational' },
  { name: 'Fawley, UK', lat: 50.8167, lon: -1.3333, status: 'operational' },
  { name: 'Foggia, Italy', lat: 41.4621, lon: 15.5444, status: 'operational' },
  { name: 'Goonhilly, UK', lat: 50.0502, lon: -5.1825, status: 'operational' },
  { name: 'Hoo, UK', lat: 51.42, lon: 0.56, status: 'planned' },
  { name: 'Ibi, Spain', lat: 38.6264, lon: -0.5726, status: 'operational' },
  { name: 'Kaunas, Lithuania', lat: 54.8985, lon: 23.9036, status: 'operational' },
  { name: 'Lepe, Spain', lat: 37.2547, lon: -7.2044, status: 'operational' },
  { name: 'Marsala, Italy', lat: 37.7986, lon: 12.4357, status: 'operational' },
  { name: 'Milano, Italy', lat: 45.4642, lon: 9.19, status: 'operational' },
  { name: 'Morn Hill, UK', lat: 51.0894, lon: -1.2833, status: 'operational' },
  { name: 'Tromsø, Norway', lat: 69.6496, lon: 18.956, status: 'operational' },
  { name: 'Usingen, Germany', lat: 50.3356, lon: 8.5361, status: 'operational' },
  { name: 'Villarejo de Salvanes, Spain', lat: 40.1667, lon: -3.2667, status: 'operational' },
  { name: "Villenave-d'Ornon, France", lat: 44.76, lon: -0.5544, status: 'operational' },
  { name: 'Wherstead, UK', lat: 52.0333, lon: 1.15, status: 'operational' },
  { name: 'Wola Krobowska, Poland', lat: 50.35, lon: 20.55, status: 'operational' },
  { name: 'Woodwalton, UK', lat: 52.4167, lon: -0.2833, status: 'operational' },
  { name: 'Akita, Japan', lat: 39.72, lon: 140.1024, status: 'operational' },
  { name: 'Angeles, Philippines', lat: 15.145, lon: 120.5887, status: 'operational' },
  { name: 'Hitachinaka, Japan', lat: 36.3967, lon: 140.5347, status: 'operational' },
  { name: 'Otaru, Japan', lat: 43.1907, lon: 140.9945, status: 'operational' },
  { name: 'Yamaguchi, Japan', lat: 34.1861, lon: 131.4706, status: 'operational' },
  { name: 'Awarua, NZ', lat: -46.5294, lon: 168.3781, status: 'operational' },
  { name: 'Bogantungan, Australia', lat: -23.6478, lon: 147.2956, status: 'operational' },
  { name: 'Boorowa, Australia', lat: -34.4392, lon: 148.7142, status: 'operational' },
  { name: 'Broken Hill, Australia', lat: -31.9505, lon: 141.4681, status: 'operational' },
  { name: 'Bulla Bulling, Australia', lat: -31.1, lon: 121.0167, status: 'operational' },
  { name: 'Calrossie, Australia', lat: -36.45, lon: 145.3, status: 'operational' },
  { name: 'Canyonleigh, Australia', lat: -34.5333, lon: 150.2, status: 'operational' },
  { name: 'Cataby, Australia', lat: -30.75, lon: 115.5333, status: 'operational' },
  { name: 'Clevedon, NZ', lat: -36.993, lon: 175.0586, status: 'operational' },
  { name: 'Cobargo, Australia', lat: -36.3886, lon: 149.89, status: 'operational' },
  { name: 'Cromwell, NZ', lat: -45.05, lon: 169.2, status: 'operational' },
  { name: 'Hinds, NZ', lat: -43.8667, lon: 171.5833, status: 'operational' },
  { name: 'Ki Ki, Australia', lat: -35.8, lon: 139.7167, status: 'operational' },
  { name: 'Merredin, Australia', lat: -31.4833, lon: 118.2833, status: 'operational' },
  { name: 'Pimba, Australia', lat: -31.2833, lon: 136.8, status: 'operational' },
  { name: 'Puwera, NZ', lat: -35.8, lon: 174.2333, status: 'operational' },
  { name: 'Springbrook Creek, Australia', lat: -24.8333, lon: 152.1167, status: 'operational' },
  { name: 'Suva, Fiji', lat: -18.1416, lon: 178.4419, status: 'operational' },
  { name: 'Te Hana, NZ', lat: -36.2667, lon: 174.55, status: 'operational' },
  { name: 'Tea Gardens, Australia', lat: -32.6667, lon: 152.15, status: 'operational' },
  { name: 'Toonpan, Australia', lat: -19.2833, lon: 146.75, status: 'operational' },
  { name: 'Torrumbarry, Australia', lat: -36.0333, lon: 144.5833, status: 'operational' },
  { name: 'Wagin, Australia', lat: -33.3167, lon: 117.35, status: 'operational' },
  { name: 'Warra, Australia', lat: -26.9833, lon: 150.9333, status: 'operational' },
  { name: 'Willows, Australia', lat: -19.3667, lon: 146.7833, status: 'operational' },
  { name: 'Bogota, Colombia', lat: 4.711, lon: -74.0721, status: 'operational' },
  { name: 'Caldera, Chile', lat: -27.0667, lon: -70.8167, status: 'operational' },
  { name: 'Camaçari, Brazil', lat: -12.6996, lon: -38.3263, status: 'operational' },
  { name: 'Falda del Carmen, Argentina', lat: -31.5333, lon: -64.45, status: 'operational' },
  { name: 'Guarapari, Brazil', lat: -20.6614, lon: -40.4981, status: 'operational' },
  { name: 'Itaboraí, Brazil', lat: -22.7446, lon: -42.8586, status: 'operational' },
  { name: 'João Câmara, Brazil', lat: -5.5372, lon: -35.8139, status: 'planned' },
  { name: 'Luz, Brazil', lat: -19.79, lon: -44.7325, status: 'operational' },
  { name: 'Manaus, Brazil', lat: -3.119, lon: -60.0217, status: 'operational' },
  { name: 'Montes Claros, Brazil', lat: -16.735, lon: -43.8617, status: 'operational' },
  { name: 'Mossoró, Brazil', lat: -5.1878, lon: -37.3441, status: 'operational' },
  { name: 'Noviciado, Chile', lat: -33.4167, lon: -70.9333, status: 'operational' },
  { name: 'Passa Quatro, Brazil', lat: -22.3869, lon: -44.9708, status: 'planned' },
  { name: 'Porto Alegre, Brazil', lat: -30.0346, lon: -51.2177, status: 'operational' },
  { name: 'Presidente Prudente, Brazil', lat: -22.1257, lon: -51.3875, status: 'operational' },
  { name: 'Puerto Montt, Chile', lat: -41.4689, lon: -72.9411, status: 'operational' },
  { name: 'Puerto Saavedra, Chile', lat: -38.7833, lon: -73.3833, status: 'operational' },
  { name: 'Punta Arenas, Chile', lat: -53.1638, lon: -70.9171, status: 'operational' },
  { name: 'Rio Negro, Brazil', lat: -26.105, lon: -49.7978, status: 'operational' },
  { name: 'San Clemente, Chile', lat: -35.5333, lon: -71.4833, status: 'operational' },
  { name: 'Santa Elena, Chile', lat: -36.8167, lon: -72.0167, status: 'operational' },
  { name: 'Santana de Parnaíba, Brazil', lat: -23.4431, lon: -46.9186, status: 'planned' },
  { name: 'São Gonçalo do Amarante, Brazil', lat: -3.6075, lon: -38.9722, status: 'planned' },
  { name: 'Sinop, Brazil', lat: -11.86, lon: -55.51, status: 'operational' },
  { name: 'Surubim, Brazil', lat: -7.8311, lon: -35.7531, status: 'operational' },
  { name: 'Uruguaiana, Brazil', lat: -29.7547, lon: -57.0883, status: 'operational' },
  { name: 'Ikire, Nigeria', lat: 7.3667, lon: 4.1833, status: 'operational' },
  { name: 'Lekki, Nigeria', lat: 6.4698, lon: 3.6015, status: 'operational' },
  { name: 'Muallim, Turkey', lat: 40.0333, lon: 30.05, status: 'operational' },
  { name: 'Murayjat, Oman', lat: 23.588, lon: 58.545, status: 'operational' },
];

// Mutable array — starts with fallback, updated in-place by refreshGroundStations()
export const GROUND_STATIONS: GroundStation[] = [...FALLBACK_STATIONS];

/** Incremented each time GROUND_STATIONS is refreshed from HF. Consumers
 *  that cache derived data (e.g. gsPositions) should watch this counter. */
export let groundStationsVersion = 0;

/**
 * Fetch fresh ground station data from the HF dataset and update
 * GROUND_STATIONS in-place. Called at server boot; non-blocking.
 * On failure, GROUND_STATIONS keeps its current (fallback) data.
 *
 * Also triggers recomputeBackhaulRTT() so GS_BACKHAUL_RTT_MS stays in sync.
 */
export async function refreshGroundStations(): Promise<void> {
  try {
    const { fetchHFGateways } = await import('./hf-ground-stations');
    const stations = await fetchHFGateways();
    if (stations.length === 0) {
      console.warn('[GS] HF returned 0 gateways, keeping fallback data');
      return;
    }
    // Mutate in-place so every module holding a reference sees the update
    GROUND_STATIONS.length = 0;
    GROUND_STATIONS.push(...stations);
    groundStationsVersion++;
    console.log(`[GS] HF ground stations loaded: ${stations.length} (v${groundStationsVersion})`);

    // Recompute backhaul RTT with new station list
    const { recomputeBackhaulRTT } = await import('../utils/backhaul-latency');
    recomputeBackhaulRTT();
  } catch (err) {
    console.warn('[GS] Failed to fetch HF ground stations, using fallback:', err);
  }
}

/**
 * Find the nearest ground station to a given lat/lon (in degrees).
 * Uses cosine-corrected longitude distance for accuracy at high latitudes.
 */
export function findNearestGroundStation(lat: number, lon: number): GroundStation {
  let nearest = GROUND_STATIONS[0];
  let minDist = Infinity;

  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (const gs of GROUND_STATIONS) {
    const dLat = gs.lat - lat;
    const dLon = (gs.lon - lon) * cosLat;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < minDist) {
      minDist = dist;
      nearest = gs;
    }
  }

  return nearest;
}
