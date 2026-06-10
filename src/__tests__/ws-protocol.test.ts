/**
 * Type-guard tests for the WS protocol.
 *
 * Bug history: guards only checked msg.type, and the client cast msg.data
 * unchecked — a status message without deviceId threw inside the handler
 * and the whole update was silently dropped (frozen telemetry).
 */
import { describe, it, expect } from 'vitest';
import {
  isStatusMessage,
  isHistoryMessage,
  isHandoffMessage,
  isEventMessage,
  createStatusMessage,
  createHandoffMessage,
  createEventMessage,
} from '../lib/websocket/protocol';
import type { WSMessage, DishStatus, HandoffEvent, EventLogEntry } from '../lib/websocket/types';

const validStatus = {
  deviceId: 'ut01000000-demo0',
  popPingLatencyMs: 32,
  downlinkThroughputBps: 1e6,
  uplinkThroughputBps: 1e5,
  uptimeSeconds: 100,
  state: 'CONNECTED',
  obstructionPercentTime: 0,
  popPingDropRate: 0,
  gpsSats: 12,
  boresightAzimuthDeg: 10,
  boresightElevationDeg: 70,
  snrAboveNoiseFloor: true,
  softwareVersion: 'v1',
} as unknown as DishStatus;

describe('isStatusMessage', () => {
  it('accepts a well-formed status message', () => {
    expect(isStatusMessage(createStatusMessage(validStatus))).toBe(true);
  });

  it('rejects a status message whose data is missing deviceId', () => {
    const { deviceId: _omit, ...rest } = validStatus as unknown as Record<string, unknown>;
    const msg = { type: 'status', data: rest, timestamp: 1 } as unknown as WSMessage;
    expect(isStatusMessage(msg)).toBe(false);
  });

  it('rejects a status message with non-object data', () => {
    const msg = { type: 'status', data: null, timestamp: 1 } as unknown as WSMessage;
    expect(isStatusMessage(msg)).toBe(false);
  });

  it('rejects non-status types', () => {
    expect(isStatusMessage({ type: 'event', data: {}, timestamp: 1 } as unknown as WSMessage)).toBe(false);
  });
});

describe('isHandoffMessage', () => {
  it('accepts a well-formed handoff message', () => {
    const handoff: HandoffEvent = { previousAzimuth: 1, previousElevation: 2, newAzimuth: 3, newElevation: 4 };
    expect(isHandoffMessage(createHandoffMessage(handoff))).toBe(true);
  });

  it('rejects a handoff message missing azimuth fields', () => {
    const msg = { type: 'handoff', data: { previousAzimuth: 1 }, timestamp: 1 } as unknown as WSMessage;
    expect(isHandoffMessage(msg)).toBe(false);
  });
});

describe('isEventMessage', () => {
  it('accepts a well-formed event message', () => {
    const entry: EventLogEntry = { timestamp: 1, message: 'hello', type: 'info' };
    expect(isEventMessage(createEventMessage(entry))).toBe(true);
  });

  it('rejects an event message without a message string', () => {
    const msg = { type: 'event', data: { timestamp: 1 }, timestamp: 1 } as unknown as WSMessage;
    expect(isEventMessage(msg)).toBe(false);
  });
});

describe('isHistoryMessage', () => {
  it('rejects history with non-object data', () => {
    const msg = { type: 'history', data: 42, timestamp: 1 } as unknown as WSMessage;
    expect(isHistoryMessage(msg)).toBe(false);
  });
});
