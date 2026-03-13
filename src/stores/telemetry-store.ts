import { create } from 'zustand';

export interface DishStatus {
  ping: number;
  downlink: number;
  uplink: number;
  snr: number;
  uptime: number;
  state: string;
  obstructions: number;
  azimuth: number;
  elevation: number;
}

export interface EventLogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface TelemetryHistory {
  ping: number[];
  downlink: number[];
  uplink: number[];
  snr: number[];
}

const RING_BUFFER_SIZE = 60;

interface TelemetryState {
  dishStatus: DishStatus | null;
  history: TelemetryHistory;
  events: EventLogEntry[];

  updateStatus: (status: DishStatus) => void;
  addEvent: (entry: EventLogEntry) => void;
  pushHistory: (values: { ping: number; downlink: number; uplink: number; snr: number }) => void;
}

function pushToRing(arr: number[], value: number): number[] {
  const next = [...arr, value];
  if (next.length > RING_BUFFER_SIZE) {
    return next.slice(next.length - RING_BUFFER_SIZE);
  }
  return next;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  dishStatus: null,
  history: {
    ping: [],
    downlink: [],
    uplink: [],
    snr: [],
  },
  events: [],

  updateStatus: (status) => set({ dishStatus: status }),

  addEvent: (entry) =>
    set((state) => ({
      events: [...state.events, entry].slice(-100), // keep last 100 events
    })),

  pushHistory: (values) =>
    set((state) => ({
      history: {
        ping: pushToRing(state.history.ping, values.ping),
        downlink: pushToRing(state.history.downlink, values.downlink),
        uplink: pushToRing(state.history.uplink, values.uplink),
        snr: pushToRing(state.history.snr, values.snr),
      },
    })),
}));
