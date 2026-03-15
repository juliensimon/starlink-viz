import { create } from 'zustand';

export interface DemoLocation {
  name: string;
  lat: number;
  lon: number;
  pop: string;     // assigned PoP for this region
  description: string;
}

/** Remote locations where ISL routing is mandatory — no nearby GS serves the local PoP.
 *  Each uses a real Starlink PoP that's far from any visible ground station. */
export const DEMO_LOCATIONS: DemoLocation[] = [
  // Each location is 2,500–5,000km from the PoP's nearest GS — far enough
  // that no GS is visible from the serving satellite (>2,500km horizon),
  // close enough for ISL to bridge the gap in 3-6 hops.
  // Each PoP's nearest GS is 2,700–3,500km from the demo location.
  // Verified via log analysis: these consistently produce ISL routes.
  { name: 'Iceland Gap',          lat: 60.0,   lon: -30.0,  pop: 'Washington DC, US', description: '2,800km to Nova Scotia — reliable 1-2 hop ISL' },
  { name: 'N Atlantic (55°N)',    lat: 55.0,   lon: -20.0,  pop: 'Chicago, US',       description: '3,500km to Canadian GSes' },
  { name: 'N Atlantic (45°N)',    lat: 45.0,   lon: -20.0,  pop: 'Washington DC, US', description: '3,400km to US East Coast' },
  { name: 'Gulf of Mexico',       lat: 25.0,   lon: -85.0,  pop: 'Seattle, US',       description: '2,900km to Pacific NW GSes' },
  { name: 'Celtic Sea',           lat: 50.0,   lon: -15.0,  pop: 'Washington DC, US', description: '3,700km to Nova Scotia' },
];

interface AppState {
  selectedSatelliteIndex: number | null;
  connectedSatelliteIndex: number | null;
  viewState: 'default' | 'tracking';
  demoMode: boolean;
  satellitesLoaded: boolean;
  autoRotate: boolean;
  focusDishRequested: number; // increment to trigger focus
  tleLastFetched: number | null; // timestamp of last successful TLE fetch
  wsConnected: boolean;
  altitudeFilter: boolean; // filter to operational altitude band (530-580 km)
  hudVisible: boolean;
  islPrediction: boolean;
  demoLocation: DemoLocation | null;

  setSelectedSatellite: (index: number | null) => void;
  setConnectedSatellite: (index: number | null) => void;
  setViewState: (state: 'default' | 'tracking') => void;
  setDemoMode: (enabled: boolean) => void;
  setSatellitesLoaded: (loaded: boolean) => void;
  setAutoRotate: (enabled: boolean) => void;
  focusDish: () => void;
  setTleLastFetched: (timestamp: number) => void;
  setWsConnected: (connected: boolean) => void;
  setAltitudeFilter: (enabled: boolean) => void;
  setHudVisible: (visible: boolean) => void;
  setISLPrediction: (enabled: boolean) => void;
  setDemoLocation: (location: DemoLocation | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSatelliteIndex: null,
  connectedSatelliteIndex: null,
  viewState: 'default',
  demoMode: false,
  satellitesLoaded: false,
  autoRotate: true,
  focusDishRequested: 0,
  tleLastFetched: null,
  wsConnected: false,
  altitudeFilter: true,
  hudVisible: true,
  islPrediction: true,
  demoLocation: null,

  setSelectedSatellite: (index) => set({ selectedSatelliteIndex: index }),
  setConnectedSatellite: (index) => set({ connectedSatelliteIndex: index }),
  setViewState: (state) => set({ viewState: state }),
  setDemoMode: (enabled) => set({
    demoMode: enabled,
    // Set Iceland Gap when entering demo, clear when leaving
    demoLocation: enabled ? DEMO_LOCATIONS[0] : null,
  }),
  setSatellitesLoaded: (loaded) => set({ satellitesLoaded: loaded }),
  setAutoRotate: (enabled) => set({ autoRotate: enabled }),
  focusDish: () => set((s) => ({ focusDishRequested: s.focusDishRequested + 1 })),
  setTleLastFetched: (timestamp) => set({ tleLastFetched: timestamp }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setAltitudeFilter: (enabled) => set({ altitudeFilter: enabled }),
  setHudVisible: (visible) => set({ hudVisible: visible }),
  setISLPrediction: (enabled) => set({ islPrediction: enabled }),
  setDemoLocation: (location) => set({ demoLocation: location }),
}));
