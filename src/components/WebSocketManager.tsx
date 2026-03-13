'use client';

import { useWebSocket } from '@/lib/websocket/client';

export default function WebSocketManager() {
  useWebSocket();
  return null;
}
