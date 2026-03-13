import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { WSMessage, DishStatus } from '../grpc/types';
import { createStatusMessage } from './protocol';

let wss: WebSocketServer | null = null;
let latestStatus: DishStatus | null = null;

export function createWSServer(httpServer: HTTPServer): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    // Only handle WebSocket upgrades for /ws path
    // Let all other upgrades (e.g. Next.js HMR/Turbopack) pass through
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request);
      });
    }
    // Do NOT destroy non-/ws sockets — Next.js needs them for HMR
  });

  wss.on('connection', (ws) => {
    console.log(`[WS] Client connected (total: ${wss!.clients.size})`);

    // Send latest status immediately on connection
    if (latestStatus) {
      const msg = createStatusMessage(latestStatus);
      ws.send(JSON.stringify(msg));
    }

    ws.on('close', () => {
      console.log(`[WS] Client disconnected (total: ${wss!.clients.size})`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  return wss;
}

export function broadcast(message: WSMessage): void {
  if (!wss) return;

  // Cache latest status for new connections
  if (message.type === 'status') {
    latestStatus = message.data as DishStatus;
  }

  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

export function getClientCount(): number {
  return wss?.clients.size ?? 0;
}
