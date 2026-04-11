import { create } from 'zustand';

export interface DemoLocation {
  name: string;
  lat: number;
  lon: number;
  pop: string;     // assigned PoP for this region
  description: string;
}

/** Demo locations for visualizing different routing scenarios.
 *  Ocean locations force ISL (no GS within satellite LoS); Lorgues is a
 *  direct-routing contrast showing normal European coverage. */
export const DEMO_LOCATIONS: DemoLocation[] = [
  // ISL-forcing ocean locations: no PoP-constrained GS within ~2,557km LoS horizon.
  // Each PoP's nearest GS is 2,700–3,500km from the demo location.
  // Verified via log analysis: these consistently produce ISL routes.
  { name: 'Iceland Gap',          lat: 60.0,    lon: -30.0,    pop: 'Washington DC, US', description: '2,800km to Nova Scotia — reliable 1-2 hop ISL' },
  { name: 'N Atlantic (55°N)',    lat: 55.0,    lon: -20.0,    pop: 'Chicago, US',       description: '3,500km to Canadian GSes' },
  { name: 'N Atlantic (45°N)',    lat: 45.0,    lon: -20.0,    pop: 'Washington DC, US', description: '3,400km to US East Coast' },
  { name: 'Gulf of Mexico',       lat: 25.0,    lon: -85.0,    pop: 'Seattle, US',       description: '2,900km to Pacific NW GSes' },
  { name: 'Celtic Sea',           lat: 50.0,    lon: -15.0,    pop: 'Washington DC, US', description: '3,700km to Nova Scotia' },
  // Punta Arenas (3,618km away) is excluded: it's 2,192km from Santiago, above the
  // 1,500km PoP–GS backhaul cap. ISL exits via Puerto Montt or Caldera instead.
  { name: 'Point Nemo',           lat: -48.877, lon: -123.393, pop: 'Santiago, CL',      description: 'Oceanic pole of inaccessibility — no GS within 2,700km, mandatory ISL' },
  // Direct-routing contrast location — near European GSes, normal latency.
  { name: 'Lorgues, France',      lat: 43.495,  lon:   6.361,  pop: 'Paris, FR',         description: 'Provence — near European GSes, direct routing' },
];

interface AppState {
  selectedSatelliteIndex: number | null;
  connectedSatelliteIndex: number | null;
  viewState: 'default' | 'tracking';
  demoMode: boolean;
  satellitesLoaded: boolean;
  satellitesVersion: number; // incremented when propagator reinitializes data
  autoRotate: boolean;
  focusDishRequested: number; // increment to trigger focus
  tleLastFetched: number | null; // timestamp of last successful TLE fetch
  wsConnected: boolean;
  altitudeFilter: boolean; // filter to per-shell operational altitude bands (see config.ts)
  hudVisible: boolean;
  islPrediction: boolean;
  demoLocation: DemoLocation | null;
  cameraMode: 'space' | 'sky';
  mobileHudTab: 'status' | 'controls' | 'network' | 'events' | null;

  setSelectedSatellite: (index: number | null) => void;
  setConnectedSatellite: (index: number | null) => void;
  setViewState: (state: 'default' | 'tracking') => void;
  setDemoMode: (enabled: boolean) => void;
  setSatellitesLoaded: (loaded: boolean) => void;
  bumpSatellitesVersion: () => void;
  setAutoRotate: (enabled: boolean) => void;
  focusDish: () => void;
  setTleLastFetched: (timestamp: number) => void;
  setWsConnected: (connected: boolean) => void;
  setAltitudeFilter: (enabled: boolean) => void;
  setHudVisible: (visible: boolean) => void;
  setISLPrediction: (enabled: boolean) => void;
  setDemoLocation: (location: DemoLocation | null) => void;
  setCameraMode: (mode: 'space' | 'sky') => void;
  setMobileHudTab: (tab: 'status' | 'controls' | 'network' | 'events' | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSatelliteIndex: null,
  connectedSatelliteIndex: null,
  viewState: 'default',
  demoMode: false,
  satellitesLoaded: false,
  satellitesVersion: 0,
  autoRotate: true,
  focusDishRequested: 0,
  tleLastFetched: null,
  wsConnected: false,
  altitudeFilter: true,
  hudVisible: true,
  islPrediction: true,
  demoLocation: null,
  cameraMode: 'space',
  mobileHudTab: null,

  setSelectedSatellite: (index) => set({ selectedSatelliteIndex: index }),
  setConnectedSatellite: (index) => set({ connectedSatelliteIndex: index }),
  setViewState: (state) => set({ viewState: state }),
  setDemoMode: (enabled) => set((s) => ({
    demoMode: enabled,
    // Set Iceland Gap only when first entering demo, clear when leaving.
    // Don't reset if already in demo (preserves user's location choice).
    demoLocation: enabled
      ? (s.demoMode ? s.demoLocation : DEMO_LOCATIONS[0])
      : null,
  })),
  setSatellitesLoaded: (loaded) => set({ satellitesLoaded: loaded }),
  bumpSatellitesVersion: () => set((s) => ({ satellitesVersion: s.satellitesVersion + 1 })),
  setAutoRotate: (enabled) => set({ autoRotate: enabled }),
  focusDish: () => set((s) => ({ focusDishRequested: s.focusDishRequested + 1 })),
  setTleLastFetched: (timestamp) => set({ tleLastFetched: timestamp }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setAltitudeFilter: (enabled) => set({ altitudeFilter: enabled }),
  setHudVisible: (visible) => set({ hudVisible: visible }),
  setISLPrediction: (enabled) => set({ islPrediction: enabled }),
  setDemoLocation: (location) => set({ demoLocation: location }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setMobileHudTab: (tab) => set({ mobileHudTab: tab }),
}));
