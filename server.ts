import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';
import { createWSServer, broadcast } from './src/lib/websocket/server';
import { initGrpcClient, getStatus, getHistory, closeGrpcClient } from './src/lib/grpc/client';
import { generateMockStatus, generateMockHistory, isHandoffOccurring } from './src/lib/grpc/mock-data';
import {
  createStatusMessage,
  createHistoryMessage,
  createHandoffMessage,
  createEventMessage,
} from './src/lib/websocket/protocol';
import type { DishStatus } from './src/lib/grpc/types';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const dishAddress = process.env.DISH_ADDRESS || '192.168.100.1:9200';
const demoModeEnv = process.env.DEMO_MODE || 'auto';

const app = next({ dev });
const handle = app.getRequestHandler();

let useDemoMode = false;
let startTime = Date.now();
let previousStatus: DishStatus | null = null;
let statusInterval: ReturnType<typeof setInterval> | null = null;
let historyInterval: ReturnType<typeof setInterval> | null = null;

const HANDOFF_THRESHOLD_DEG = 10;

async function detectDishAvailability(): Promise<boolean> {
  if (demoModeEnv === 'true') {
    console.log('\u{1F3AD} Demo mode forced via DEMO_MODE=true');
    return false;
  }
  if (demoModeEnv === 'false') {
    console.log('\u{1F4E1} Real mode forced via DEMO_MODE=false');
    return true;
  }

  // Auto-detect: try connecting to the dish
  console.log(`\u{1F50D} Auto-detecting dish at ${dishAddress}...`);
  const connected = await initGrpcClient(dishAddress);
  if (connected) {
    console.log(`\u{1F4E1} Connected to dish at ${dishAddress}`);
    return true;
  } else {
    console.log(`\u{1F3AD} Dish unreachable, activating demo mode`);
    return false;
  }
}

function detectHandoff(current: DishStatus): void {
  if (!previousStatus) {
    previousStatus = current;
    return;
  }

  const azDelta = Math.abs(current.boresightAzimuth - previousStatus.boresightAzimuth);
  const elDelta = Math.abs(current.boresightElevation - previousStatus.boresightElevation);

  if (azDelta > HANDOFF_THRESHOLD_DEG || elDelta > HANDOFF_THRESHOLD_DEG) {
    broadcast(
      createHandoffMessage({
        previousAzimuth: previousStatus.boresightAzimuth,
        previousElevation: previousStatus.boresightElevation,
        newAzimuth: current.boresightAzimuth,
        newElevation: current.boresightElevation,
      })
    );

    broadcast(
      createEventMessage({
        timestamp: Date.now(),
        message: `Satellite handoff: az ${previousStatus.boresightAzimuth.toFixed(1)}\u00B0 \u2192 ${current.boresightAzimuth.toFixed(1)}\u00B0, el ${previousStatus.boresightElevation.toFixed(1)}\u00B0 \u2192 ${current.boresightElevation.toFixed(1)}\u00B0`,
        type: 'handoff',
      })
    );
  }

  previousStatus = current;
}

async function pollStatus(): Promise<void> {
  let status: DishStatus | null = null;

  if (useDemoMode) {
    const elapsed = Date.now() - startTime;
    status = generateMockStatus(elapsed);
  } else {
    status = await getStatus();
    if (!status) {
      // Dish became unreachable, fallback to demo mode
      console.warn('\u26A0\uFE0F Dish unreachable, falling back to demo mode');
      useDemoMode = true;
      const elapsed = Date.now() - startTime;
      status = generateMockStatus(elapsed);
    }
  }

  if (status) {
    detectHandoff(status);
    broadcast(createStatusMessage(status));
  }
}

async function pollHistory(): Promise<void> {
  if (useDemoMode) {
    const history = generateMockHistory();
    broadcast(createHistoryMessage(history));
  } else {
    const history = await getHistory();
    if (history) {
      broadcast(createHistoryMessage(history));
    }
  }
}

async function main() {
  console.log('\u{1F6F0}\uFE0F  Starlink Mission Control starting...');
  console.log(`   Port: ${port}`);
  console.log(`   Dish address: ${dishAddress}`);
  console.log(`   Demo mode: ${demoModeEnv}`);
  console.log('');

  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  // Attach WebSocket server
  createWSServer(server);

  // Detect dish availability
  const dishAvailable = await detectDishAvailability();
  useDemoMode = !dishAvailable;
  startTime = Date.now();

  if (useDemoMode) {
    broadcast(
      createEventMessage({
        timestamp: Date.now(),
        message: 'Demo mode active \u2014 showing simulated telemetry',
        type: 'info',
      })
    );
  } else {
    broadcast(
      createEventMessage({
        timestamp: Date.now(),
        message: `Connected to Starlink dish at ${dishAddress}`,
        type: 'info',
      })
    );
  }

  // Start polling loops
  statusInterval = setInterval(pollStatus, 1000);
  historyInterval = setInterval(pollHistory, 5000);

  // Initial polls
  pollStatus();
  pollHistory();

  server.listen(port, () => {
    console.log(`\u{1F680} Server listening on http://localhost:${port}`);
    console.log(
      useDemoMode
        ? '\u{1F3AD} Running in DEMO mode with simulated telemetry'
        : `\u{1F4E1} Connected to dish at ${dishAddress}`
    );
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n\u{1F6D1} Shutting down...');
    if (statusInterval) clearInterval(statusInterval);
    if (historyInterval) clearInterval(historyInterval);
    closeGrpcClient();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
