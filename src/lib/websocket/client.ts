'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { useAppStore } from '@/stores/app-store';
import type { WSMessage, DishStatus, DishHistory, HandoffEvent, EventLogEntry } from '../grpc/types';

const setWsConnected = (connected: boolean) => useAppStore.getState().setWsConnected(connected);

interface UseWebSocketReturn {
  connected: boolean;
  lastMessage: WSMessage | null;
  dishStatus: DishStatus | null;
  dishHistory: DishHistory | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [dishStatus, setDishStatus] = useState<DishStatus | null>(null);
  const [dishHistory, setDishHistory] = useState<DishHistory | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const updateStatus = useTelemetryStore((s) => s.updateStatus);
  const pushHistory = useTelemetryStore((s) => s.pushHistory);
  const addEvent = useTelemetryStore((s) => s.addEvent);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        setLastMessage(msg);

        switch (msg.type) {
          case 'status': {
            const status = msg.data as DishStatus;
            setDishStatus(status);

            // Detect demo mode from device ID immediately (not deferred)
            const isDemoDevice = status.deviceId.includes('demo');
            useAppStore.getState().setDemoMode(isDemoDevice);

            // Az/el are always computed client-side by ConnectionBeam
            // (dish only reports physical antenna tilt, not active beam direction)
            const currentStatus = useTelemetryStore.getState().dishStatus;
            updateStatus({
              ping: status.popPingLatency,
              downlink: status.downlinkThroughput,
              uplink: status.uplinkThroughput,
              snr: status.snr,
              uptime: status.uptime,
              state: status.state,
              obstructions: status.obstructionPercentTime,
              azimuth: currentStatus?.azimuth ?? 0,
              elevation: currentStatus?.elevation ?? 0,
              dropRate: status.popPingDropRate,
              gpsSats: status.gpsSats,
              antennaBoresightAz: status.boresightAzimuth,
              antennaBoresightEl: status.boresightElevation,
              deviceId: status.deviceId,
              softwareVersion: status.softwareVersion,
            });

            // Push to history ring buffer
            pushHistory({
              ping: status.popPingLatency,
              downlink: status.downlinkThroughput,
              uplink: status.uplinkThroughput,
              snr: status.snr,
            });
            break;
          }

          case 'history': {
            const history = msg.data as DishHistory;
            setDishHistory(history);
            break;
          }

          case 'handoff': {
            const handoff = msg.data as HandoffEvent;
            addEvent({
              timestamp: Date.now(),
              message: `Handoff: az ${handoff.previousAzimuth.toFixed(1)}\u00B0 \u2192 ${handoff.newAzimuth.toFixed(1)}\u00B0, el ${handoff.previousElevation.toFixed(1)}\u00B0 \u2192 ${handoff.newElevation.toFixed(1)}\u00B0`,
              type: 'success',
            });
            break;
          }

          case 'event': {
            const entry = msg.data as EventLogEntry;
            addEvent({
              timestamp: entry.timestamp,
              message: entry.message,
              type: entry.type === 'handoff' ? 'success' : entry.type,
            });
            break;
          }
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    },
    [updateStatus, pushHistory, addEvent]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      setWsConnected(true);
      reconnectDelayRef.current = 1000;
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      setWsConnected(false);
      wsRef.current = null;

      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 10000);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      console.warn('[WS] Connection error — server may not be running (use `npm run dev` for full backend)');
    };

    ws.onmessage = handleMessage;
  }, [handleMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected, lastMessage, dishStatus, dishHistory };
}
