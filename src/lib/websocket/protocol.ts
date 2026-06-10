import type {
  WSMessage,
  DishStatus,
  DishHistory,
  HandoffEvent,
  EventLogEntry,
} from './types';

// --- Type guards ---
// Each guard validates the fields its consumers actually dereference, so a
// malformed message is rejected at the boundary instead of throwing (and
// silently dropping the update) inside a handler.

function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null;
}

export function isStatusMessage(
  msg: WSMessage
): msg is WSMessage & { data: DishStatus } {
  if (msg.type !== 'status' || !isObject(msg.data)) return false;
  const d = msg.data as Record<string, unknown>;
  return (
    typeof d.deviceId === 'string' &&
    typeof d.popPingLatencyMs === 'number' &&
    typeof d.boresightAzimuthDeg === 'number' &&
    typeof d.boresightElevationDeg === 'number'
  );
}

export function isHistoryMessage(
  msg: WSMessage
): msg is WSMessage & { data: DishHistory } {
  return msg.type === 'history' && isObject(msg.data);
}

export function isHandoffMessage(
  msg: WSMessage
): msg is WSMessage & { data: HandoffEvent } {
  if (msg.type !== 'handoff' || !isObject(msg.data)) return false;
  const d = msg.data as Record<string, unknown>;
  return (
    typeof d.previousAzimuth === 'number' &&
    typeof d.previousElevation === 'number' &&
    typeof d.newAzimuth === 'number' &&
    typeof d.newElevation === 'number'
  );
}

export function isEventMessage(
  msg: WSMessage
): msg is WSMessage & { data: EventLogEntry } {
  if (msg.type !== 'event' || !isObject(msg.data)) return false;
  const d = msg.data as Record<string, unknown>;
  return typeof d.message === 'string' && typeof d.timestamp === 'number';
}

// --- Message creators ---

export function createStatusMessage(status: DishStatus): WSMessage {
  return {
    type: 'status',
    data: status,
    timestamp: Date.now(),
  };
}

export function createHistoryMessage(history: DishHistory): WSMessage {
  return {
    type: 'history',
    data: history,
    timestamp: Date.now(),
  };
}

export function createHandoffMessage(handoff: HandoffEvent): WSMessage {
  return {
    type: 'handoff',
    data: handoff,
    timestamp: Date.now(),
  };
}

export function createEventMessage(event: EventLogEntry): WSMessage {
  return {
    type: 'event',
    data: event,
    timestamp: Date.now(),
  };
}
