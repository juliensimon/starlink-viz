import type {
  WSMessage,
  DishStatus,
  DishHistory,
  HandoffEvent,
  EventLogEntry,
} from './types';

// --- Type guards ---

export function isStatusMessage(
  msg: WSMessage
): msg is WSMessage & { data: DishStatus } {
  return msg.type === 'status';
}

export function isHistoryMessage(
  msg: WSMessage
): msg is WSMessage & { data: DishHistory } {
  return msg.type === 'history';
}

export function isHandoffMessage(
  msg: WSMessage
): msg is WSMessage & { data: HandoffEvent } {
  return msg.type === 'handoff';
}

export function isEventMessage(
  msg: WSMessage
): msg is WSMessage & { data: EventLogEntry } {
  return msg.type === 'event';
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
