'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { useAppStore } from '@/stores/app-store';
import type { WSMessage, DishStatus, DishHistory, HandoffEvent, EventLogEntry } from '../grpc/types';

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
  const previousStatusRef = useRef<DishStatus | null>(null);

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

            // Update telemetry store
            updateStatus({
              ping: status.popPingLatency,
              downlink: status.downlinkThroughput,
              uplink: status.uplinkThroughput,
              snr: status.snr,
              uptime: status.uptime,
              state: status.state,
              obstructions: status.obstructionPercentTime,
              azimuth: status.boresightAzimuth,
              elevation: status.boresightElevation,
            });

            // Push to history ring buffer
            pushHistory({
              ping: status.popPingLatency,
              downlink: status.downlinkThroughput,
              uplink: status.uplinkThroughput,
              snr: status.snr,
            });

            // Detect handoff from boresight changes
            const prev = previousStatusRef.current;
            if (prev) {
              const azDelta = Math.abs(status.boresightAzimuth - prev.boresightAzimuth);
              const elDelta = Math.abs(status.boresightElevation - prev.boresightElevation);
              if (azDelta > 10 || elDelta > 10) {
                addEvent({
                  timestamp: Date.now(),
                  message: `Satellite handoff detected (az: ${prev.boresightAzimuth.toFixed(1)} -> ${status.boresightAzimuth.toFixed(1)}, el: ${prev.boresightElevation.toFixed(1)} -> ${status.boresightElevation.toFixed(1)})`,
                  type: 'success',
                });
              }
            }
            previousStatusRef.current = status;
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
              message: `Handoff: az ${handoff.previousAzimuth.toFixed(1)} -> ${handoff.newAzimuth.toFixed(1)}, el ${handoff.previousElevation.toFixed(1)} -> ${handoff.newElevation.toFixed(1)}`,
              type: 'success',
            });
            break;
          }

          case 'event': {
            const entry = msg.data as EventLogEntry;
            addEvent({
              timestamp: entry.timestamp,
              message: entry.message,
              // Map 'handoff' type to 'success' for the telemetry store
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
      reconnectDelayRef.current = 1000; // Reset backoff
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      wsRef.current = null;

      // Reconnect with exponential backoff
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 10000);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
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

  // Update app store demo mode based on device ID
  useEffect(() => {
    if (dishStatus) {
      const isDemoMode = dishStatus.deviceId.includes('demo');
      useAppStore.getState().setDemoMode(isDemoMode);
    }
  }, [dishStatus]);

  return { connected, lastMessage, dishStatus, dishHistory };
}
