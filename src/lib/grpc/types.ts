export type {
  DishStatus,
  DishHistory,
} from 'starlink-dish';

export interface WSMessage {
  type: 'status' | 'history' | 'handoff' | 'event';
  data: import('starlink-dish').DishStatus | import('starlink-dish').DishHistory | HandoffEvent | EventLogEntry;
  timestamp: number;
}

export interface HandoffEvent {
  previousAzimuth: number;
  previousElevation: number;
  newAzimuth: number;
  newElevation: number;
}

export interface EventLogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'error' | 'handoff';
}
