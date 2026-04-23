import type { DishStatus, DishHistory } from 'starlink-dish';

export type { DishStatus, DishHistory };

export interface WSMessage {
  type: 'status' | 'history' | 'handoff' | 'event';
  data: DishStatus | DishHistory | HandoffEvent | EventLogEntry;
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
