export interface DishStatus {
  deviceId: string;
  hardwareVersion: string;
  softwareVersion: string;
  state: string; // 'CONNECTED' | 'SEARCHING' | 'BOOTING' | 'UNKNOWN'
  uptime: number; // seconds
  snr: number;
  downlinkThroughput: number; // bytes/s
  uplinkThroughput: number; // bytes/s
  popPingLatency: number; // ms
  popPingDropRate: number; // 0-1
  obstructionPercentTime: number; // 0-100
  boresightAzimuth: number; // degrees
  boresightElevation: number; // degrees
  gpsSats: number;
  alerts: string[];
}

export interface DishHistory {
  pingLatency: number[];
  downlinkThroughput: number[];
  uplinkThroughput: number[];
  snr: number[];
}

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
