import { create } from 'zustand';

interface AppState {
  selectedSatelliteIndex: number | null;
  connectedSatelliteIndex: number | null;
  viewState: 'default' | 'tracking';
  demoMode: boolean;
  satellitesLoaded: boolean;

  setSelectedSatellite: (index: number | null) => void;
  setConnectedSatellite: (index: number | null) => void;
  setViewState: (state: 'default' | 'tracking') => void;
  setDemoMode: (enabled: boolean) => void;
  setSatellitesLoaded: (loaded: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSatelliteIndex: null,
  connectedSatelliteIndex: null,
  viewState: 'default',
  demoMode: false,
  satellitesLoaded: false,

  setSelectedSatellite: (index) => set({ selectedSatelliteIndex: index }),
  setConnectedSatellite: (index) => set({ connectedSatelliteIndex: index }),
  setViewState: (state) => set({ viewState: state }),
  setDemoMode: (enabled) => set({ demoMode: enabled }),
  setSatellitesLoaded: (loaded) => set({ satellitesLoaded: loaded }),
}));
