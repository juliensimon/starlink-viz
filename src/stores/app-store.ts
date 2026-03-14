import { create } from 'zustand';

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

  setSelectedSatellite: (index) => set({ selectedSatelliteIndex: index }),
  setConnectedSatellite: (index) => set({ connectedSatelliteIndex: index }),
  setViewState: (state) => set({ viewState: state }),
  setDemoMode: (enabled) => set({ demoMode: enabled }),
  setSatellitesLoaded: (loaded) => set({ satellitesLoaded: loaded }),
  setAutoRotate: (enabled) => set({ autoRotate: enabled }),
  focusDish: () => set((s) => ({ focusDishRequested: s.focusDishRequested + 1 })),
  setTleLastFetched: (timestamp) => set({ tleLastFetched: timestamp }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setAltitudeFilter: (enabled) => set({ altitudeFilter: enabled }),
  setHudVisible: (visible) => set({ hudVisible: visible }),
}));
