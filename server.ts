import { createServer } from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import next from 'next';
import { parse } from 'url';
import { createWSServer, broadcast } from './src/lib/websocket/server';
import { initGrpcClient, getStatus, getHistory, closeGrpcClient } from './src/lib/grpc/client';
import { generateMockStatus, generateMockHistory } from './src/lib/grpc/mock-data';
import {
  createStatusMessage,
  createHistoryMessage,
  createHandoffMessage,
  createEventMessage,
} from './src/lib/websocket/protocol';
import type { DishStatus } from './src/lib/grpc/types';
import { parsePopHostname } from './src/lib/utils/pop';
import { runTraceroute } from './src/lib/utils/traceroute';
import { refreshGroundStations } from './src/lib/satellites/ground-stations';

const execFileAsync = promisify(execFile);

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const dishAddress = process.env.DISH_ADDRESS || '192.168.100.1:9200';
const demoModeEnv = process.env.DEMO_MODE || 'auto';
const statusPollMs = parseInt(process.env.STATUS_POLL_MS || '1000', 10);
const historyPollMs = parseInt(process.env.HISTORY_POLL_MS || '5000', 10);
const popPollMs = parseInt(process.env.POP_POLL_MS || '10000', 10);
const telemetryLogEvery = parseInt(process.env.TELEMETRY_LOG_EVERY || '5', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

let useDemoMode = false;
let startTime = Date.now();
let previousStatus: DishStatus | null = null;
let statusInterval: ReturnType<typeof setInterval> | null = null;
let historyInterval: ReturnType<typeof setInterval> | null = null;
let popInterval: ReturnType<typeof setInterval> | null = null;
let tracerouteInterval: ReturnType<typeof setInterval> | null = null;
let telemetryLogCounter = 0;
let currentPop = '';

async function pollPop(): Promise<void> {
  try {
    const { stdout: ipRaw } = await execFileAsync('curl', ['-s', '--max-time', '3', 'ifconfig.me']);
    const ip = ipRaw.trim();
    // Validate IP format before passing to dig
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return;
    const { stdout: rdns } = await execFileAsync('dig', ['-x', ip, '+short']);
    const pop = parsePopHostname(rdns.trim()) || 'Unknown';

    if (pop !== 'Unknown' && pop !== currentPop) {
      const previous = currentPop;
      currentPop = pop;
      console.log(`[POP] ${previous ? previous + ' \u2192 ' : ''}${pop} (${rdns.trim()})`);

      if (previous) {
        broadcast(
          createEventMessage({
            timestamp: Date.now(),
            message: `PoP switch: ${previous} \u2192 ${pop}`,
            type: 'warning',
          })
        );
      } else {
        broadcast(
          createEventMessage({
            timestamp: Date.now(),
            message: `PoP: ${pop}`,
            type: 'info',
          })
        );
      }
    }
  } catch {
    // Silently ignore — network might be briefly unavailable
  }
}

const HANDOFF_THRESHOLD_DEG = 10;

async function detectDishAvailability(): Promise<boolean> {
  if (demoModeEnv === 'true') {
    console.log('\u{1F3AD} Demo mode forced via DEMO_MODE=true');
    return false;
  }
  if (demoModeEnv === 'false') {
    console.log(`\u{1F4E1} Real mode forced via DEMO_MODE=false`);
    console.log(`\u{1F50D} Connecting to dish at ${dishAddress}...`);
    const connected = await initGrpcClient(dishAddress);
    if (!connected) {
      console.error(`\u{274C} Failed to connect to dish at ${dishAddress}`);
    }
    return connected;
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
    // Only detect handoffs from real dish data — in demo mode,
    // handoffs are detected client-side from real satellite positions
    if (!useDemoMode) {
      detectHandoff(status);

      // Log live dish data to console
      const dl = ((status.downlinkThroughput * 8) / 1_000_000).toFixed(1);
      const ul = ((status.uplinkThroughput * 8) / 1_000_000).toFixed(1);
      console.log(
        `[DISH] ping=${status.popPingLatency.toFixed(1)}ms ` +
        `dl=${dl}Mbps ul=${ul}Mbps ` +
        `az=${status.boresightAzimuth.toFixed(1)}\u00B0 el=${status.boresightElevation.toFixed(1)}\u00B0 ` +
        `drop=${(status.popPingDropRate * 100).toFixed(2)}% ` +
        `obstruct=${status.obstructionPercentTime.toFixed(2)}% ` +
        `state=${status.state}`
      );

      // Broadcast telemetry summary to UI event log every 10 polls (~10s)
      telemetryLogCounter++;
      if (telemetryLogCounter % telemetryLogEvery === 0) {
        broadcast(
          createEventMessage({
            timestamp: Date.now(),
            message: `Dish: ping ${status.popPingLatency.toFixed(0)}ms | \u2193${dl} \u2191${ul} Mbps | az ${status.boresightAzimuth.toFixed(1)}\u00B0 el ${status.boresightElevation.toFixed(1)}\u00B0`,
            type: 'info',
          })
        );
      }
    }
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

  // Non-blocking: swap fallback data with fresh HF data when ready
  refreshGroundStations();

  const server = createServer(async (req, res) => {
    // Mode switch API
    if (req.url === '/api/mode' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ mode: useDemoMode ? 'demo' : 'live' }));
      return;
    }
    if (req.url === '/api/mode' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { mode } = JSON.parse(body);
          if (mode === 'demo') {
            useDemoMode = true;
            startTime = Date.now();
            closeGrpcClient();
            console.log('\u{1F3AD} Switched to DEMO mode');
            broadcast(createEventMessage({
              timestamp: Date.now(), message: 'Switched to demo mode', type: 'info',
            }));
          } else if (mode === 'live') {
            console.log(`\u{1F4E1} Switching to LIVE mode, connecting to ${dishAddress}...`);
            const connected = await initGrpcClient(dishAddress);
            if (connected) {
              useDemoMode = false;
              console.log(`\u{1F4E1} Connected to dish at ${dishAddress}`);
              broadcast(createEventMessage({
                timestamp: Date.now(), message: `Live mode \u2014 connected to ${dishAddress}`, type: 'info',
              }));
            } else {
              console.error('\u{274C} Failed to connect to dish');
              broadcast(createEventMessage({
                timestamp: Date.now(), message: 'Failed to connect to dish \u2014 staying in demo mode', type: 'error',
              }));
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ mode: useDemoMode ? 'demo' : 'live' }));
        } catch {
          res.writeHead(400);
          res.end('Invalid request');
        }
      });
      return;
    }

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

  // Periodic traceroute (every 60s, rotates destinations)
  const TRACEROUTE_TARGETS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
  let tracerouteIdx = 0;

  async function pollTraceroute() {
    if (useDemoMode) return;
    const target = TRACEROUTE_TARGETS[tracerouteIdx % TRACEROUTE_TARGETS.length];
    tracerouteIdx++;

    const result = await runTraceroute(target);
    if (result.hops.length === 0) return;

    const parts: string[] = [];
    if (result.satelliteLinkMs !== null) parts.push(`sat ${result.satelliteLinkMs.toFixed(0)}ms`);
    if (result.pop) parts.push(`PoP ${result.pop}`);
    if (result.totalMs !== null) parts.push(`total ${result.totalMs.toFixed(0)}ms`);
    parts.push(`${result.hops.length} hops`);

    console.log(`[TRACE] ${target}: ${parts.join(' | ')}`);
    broadcast(
      createEventMessage({
        timestamp: Date.now(),
        message: `Trace ${target}: ${parts.join(' | ')}`,
        type: 'info',
      })
    );
  }

  // Start polling loops
  statusInterval = setInterval(pollStatus, statusPollMs);
  historyInterval = setInterval(pollHistory, historyPollMs);
  popInterval = setInterval(pollPop, popPollMs);
  tracerouteInterval = setInterval(pollTraceroute, 60000);

  // Initial polls
  pollStatus();
  pollHistory();
  pollPop();
  setTimeout(pollTraceroute, 5000); // Delay first traceroute to not block startup

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
    if (popInterval) clearInterval(popInterval);
    if (tracerouteInterval) clearInterval(tracerouteInterval);
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
