# starlink-dish Library + CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone TypeScript npm library + CLI that wraps the Starlink dish gRPC API, published as `starlink-dish` on npm and `github.com/juliensimon/starlink-dish`.

**Architecture:** Module-level transport state (`src/transport.ts`) is the central injectable seam — real gRPC client and mock mode both write to it. Each API command has a pure `parse*()` function for unit testing without network, plus a `get*()`/`do*()` integration function that reads the transport. CLI is a thin `commander` layer on top.

**Tech Stack:** TypeScript 5, `@grpc/grpc-js`, `@grpc/proto-loader`, `commander` (CLI), `vitest` (tests)

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/types.ts` | Public types: `DishStatus`, `DishHistory`, `SpeedTestResult`, `MockOptions` |
| `src/transport.ts` | Internal: `HandleFn` type, `setHandle()`, `clearHandle()`, `getHandle()`, `isConnected()` |
| `src/client.ts` | `initClient(address?)`, `closeClient()` — loads proto, creates gRPC client |
| `src/status.ts` | `parseStatus(raw)` pure fn + `getStatus()` |
| `src/history.ts` | `parseHistory(raw)` pure fn + `getHistory()` |
| `src/control.ts` | `reboot()`, `speedTest()` |
| `src/mock.ts` | `useMock(options?)` — installs mock transport with generated data |
| `src/index.ts` | Re-exports all public API |
| `proto/dish.proto` | Extended proto with reboot + speedtest messages |
| `cli/format.ts` | Pure formatting functions: `formatStatus()`, `formatHistory()`, `formatSpeedTest()` |
| `cli/index.ts` | `commander`-based CLI: status, history, reboot, speed-test |
| `tests/transport.test.ts` | Transport layer unit tests |
| `tests/status.test.ts` | `parseStatus()` unit + `getStatus()` integration tests |
| `tests/history.test.ts` | `parseHistory()` unit + `getHistory()` integration tests |
| `tests/control.test.ts` | `reboot()` + `speedTest()` tests |
| `tests/mock.test.ts` | `useMock()` end-to-end tests |
| `.github/workflows/ci.yml` | tsc + vitest on push/PR to main |
| `.github/workflows/publish.yml` | npm publish on release tag `v*` |

---

## Task 1: Scaffold the repo

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `proto/dish.proto`
- Create: `src/types.ts` (placeholder)
- Create: `src/index.ts` (placeholder)

- [ ] **Step 1: Create repo and directory structure**

```bash
mkdir starlink-dish && cd starlink-dish
git init
mkdir -p src proto cli tests .github/workflows
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "starlink-dish",
  "version": "0.1.0",
  "description": "TypeScript client library and CLI for the Starlink dish local gRPC API",
  "main": "dist/src/index.js",
  "types": "dist/src/index.d.ts",
  "bin": { "starlink-dish": "dist/cli/index.js" },
  "files": ["dist", "proto", "README.md"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": ["starlink", "grpc", "satellite", "spacex"],
  "license": "MIT",
  "dependencies": {
    "@grpc/grpc-js": "^1.12.0",
    "@grpc/proto-loader": "^0.7.15",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "cli/**/*"],
  "exclude": ["tests/**/*", "dist/**/*", "node_modules/**/*"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Copy `dish.proto` from the visualization app**

Copy `src/lib/grpc/dish.proto` from the starlink visualization repo into `proto/dish.proto`. This is the baseline we will extend in Task 9.

- [ ] **Step 6: Create empty placeholder files**

`src/types.ts`:
```typescript
// types defined in Task 2
```

`src/index.ts`:
```typescript
// exports wired in Task 13
```

- [ ] **Step 7: Install dependencies and verify TypeScript compiles**

```bash
npm install
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold starlink-dish package"
```

---

## Task 2: Define public types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export interface DishStatus {
  deviceId: string;
  hardwareVersion: string;
  softwareVersion: string;
  countryCode: string;
  bootcount: number;
  uptimeSeconds: number;
  state: 'CONNECTED' | 'UNKNOWN';
  downlinkThroughputBps: number;
  uplinkThroughputBps: number;
  popPingLatencyMs: number;
  popPingDropRate: number;
  obstructionPercentTime: number;
  currentlyObstructed: boolean;
  snrAboveNoiseFloor: boolean;
  snrPersistentlyLow: boolean;
  boresightAzimuthDeg: number;
  boresightElevationDeg: number;
  gpsValid: boolean;
  gpsSats: number;
  ethSpeedMbps: number;
  alerts: string[];
}

export interface DishHistory {
  current: number;
  pingLatencyMs: number[];
  pingDropRate: number[];
  downlinkThroughputBps: number[];
  uplinkThroughputBps: number[];
}

export interface SpeedTestResult {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
}

export interface MockOptions {
  faultRate?: number;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: define public DishStatus, DishHistory, SpeedTestResult, MockOptions types"
```

---

## Task 3: Transport layer

**Files:**
- Create: `src/transport.ts`
- Create: `tests/transport.test.ts`

- [ ] **Step 1: Write failing tests for transport layer**

```typescript
// tests/transport.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { isConnected, setHandle, clearHandle, getHandle } from '../src/transport';

describe('transport', () => {
  afterEach(() => clearHandle());

  it('isConnected() is false initially', () => {
    clearHandle();
    expect(isConnected()).toBe(false);
  });

  it('isConnected() is true after setHandle()', () => {
    setHandle((_req, cb) => cb(null, {}));
    expect(isConnected()).toBe(true);
  });

  it('isConnected() is false after clearHandle()', () => {
    setHandle((_req, cb) => cb(null, {}));
    clearHandle();
    expect(isConnected()).toBe(false);
  });

  it('getHandle() returns the function set by setHandle()', () => {
    const fn = (_req: unknown, cb: (err: null, res: unknown) => void) => cb(null, { ok: true });
    setHandle(fn);
    expect(getHandle()).toBe(fn);
  });

  it('getHandle() returns null after clearHandle()', () => {
    setHandle((_req, cb) => cb(null, {}));
    clearHandle();
    expect(getHandle()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npx vitest run tests/transport.test.ts
```

Expected: `Error: Cannot find module '../src/transport'`

- [ ] **Step 3: Implement `src/transport.ts`**

```typescript
import type { ServiceError } from '@grpc/grpc-js';

export type HandleFn = (
  request: unknown,
  callback: (err: ServiceError | null, response: unknown) => void
) => void;

let _handle: HandleFn | null = null;

export function setHandle(fn: HandleFn): void { _handle = fn; }
export function clearHandle(): void { _handle = null; }
export function getHandle(): HandleFn | null { return _handle; }
export function isConnected(): boolean { return _handle !== null; }
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npx vitest run tests/transport.test.ts
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/transport.ts tests/transport.test.ts
git commit -m "feat: add transport layer with injectable handle"
```

---

## Task 4: gRPC client

**Files:**
- Create: `src/client.ts`
- Modify: `tests/transport.test.ts`

- [ ] **Step 1: Write failing tests for initClient / closeClient**

Append to `tests/transport.test.ts`:

```typescript
import { initClient, closeClient } from '../src/client';

describe('initClient()', () => {
  afterEach(() => closeClient());

  it('returns false when address is unreachable', async () => {
    const result = await initClient('127.0.0.1:19999');
    expect(result).toBe(false);
  }, 5000);

  it('sets isConnected() to false after closeClient()', async () => {
    closeClient();
    expect(isConnected()).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify tests fail**

```bash
npx vitest run tests/transport.test.ts
```

Expected: `Error: Cannot find module '../src/client'`

- [ ] **Step 3: Implement `src/client.ts`**

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { setHandle, clearHandle } from './transport';

const PROTO_PATH = path.join(__dirname, '../../proto/dish.proto');

export async function initClient(address = '192.168.100.1:9200'): Promise<boolean> {
  try {
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: false,
      longs: Number,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const proto = grpc.loadPackageDefinition(packageDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DeviceService = (proto as any).SpaceX?.API?.Device?.Device;
    if (!DeviceService) return false;

    const client = new DeviceService(address, grpc.credentials.createInsecure(), {
      'grpc.keepalive_time_ms': 10000,
      'grpc.keepalive_timeout_ms': 5000,
    });

    return new Promise((resolve) => {
      const deadline = new Date(Date.now() + 3000);
      client.waitForReady(deadline, (err: Error | null) => {
        if (err) { resolve(false); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setHandle((client as any).handle.bind(client));
        resolve(true);
      });
    });
  } catch {
    return false;
  }
}

export function closeClient(): void {
  clearHandle();
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npx vitest run tests/transport.test.ts
```

Expected: all 7 tests pass. The unreachable-address test takes up to 3s then returns false.

- [ ] **Step 5: Commit**

```bash
git add src/client.ts tests/transport.test.ts
git commit -m "feat: add initClient() and closeClient() gRPC connection management"
```

---

## Task 5: Status parsing — unit tests

**Files:**
- Create: `tests/status.test.ts`
- Create: `src/status.ts`

- [ ] **Step 1: Write failing unit tests for `parseStatus()`**

```typescript
// tests/status.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { parseStatus, getStatus } from '../src/status';
import { setHandle, clearHandle } from '../src/transport';

describe('parseStatus()', () => {
  it('maps all dishGetStatus fields to DishStatus', () => {
    const raw = {
      dishGetStatus: {
        deviceInfo: {
          id: 'ut01-abc',
          hardwareVersion: '4.0',
          softwareVersion: '2025.12.0',
          countryCode: 'US',
          bootcount: 7,
        },
        deviceState: { uptimeS: 86400 },
        downlinkThroughputBps: 110_000_000,
        uplinkThroughputBps: 12_000_000,
        popPingLatencyMs: 28.3,
        popPingDropRate: 0.002,
        obstructionStats: { fractionObstructed: 0.005, currentlyObstructed: false },
        isSnrAboveNoiseFloor: true,
        isSnrPersistentlyLow: false,
        boresightAzimuthDeg: 185.0,
        boresightElevationDeg: 50.0,
        gpsStats: { gpsValid: true, gpsSats: 9 },
        ethSpeedMbps: 1000,
        alerts: {},
      },
    };

    const s = parseStatus(raw);

    expect(s).not.toBeNull();
    expect(s!.deviceId).toBe('ut01-abc');
    expect(s!.hardwareVersion).toBe('4.0');
    expect(s!.softwareVersion).toBe('2025.12.0');
    expect(s!.countryCode).toBe('US');
    expect(s!.bootcount).toBe(7);
    expect(s!.uptimeSeconds).toBe(86400);
    expect(s!.state).toBe('CONNECTED');
    expect(s!.downlinkThroughputBps).toBe(110_000_000);
    expect(s!.uplinkThroughputBps).toBe(12_000_000);
    expect(s!.popPingLatencyMs).toBe(28.3);
    expect(s!.popPingDropRate).toBe(0.002);
    expect(s!.obstructionPercentTime).toBeCloseTo(0.5);
    expect(s!.currentlyObstructed).toBe(false);
    expect(s!.snrAboveNoiseFloor).toBe(true);
    expect(s!.snrPersistentlyLow).toBe(false);
    expect(s!.boresightAzimuthDeg).toBe(185.0);
    expect(s!.boresightElevationDeg).toBe(50.0);
    expect(s!.gpsValid).toBe(true);
    expect(s!.gpsSats).toBe(9);
    expect(s!.ethSpeedMbps).toBe(1000);
    expect(s!.alerts).toEqual([]);
  });

  it('returns null when dishGetStatus is absent', () => {
    expect(parseStatus(null)).toBeNull();
    expect(parseStatus({})).toBeNull();
    expect(parseStatus({ dishGetHistory: {} })).toBeNull();
  });

  it('uses UNKNOWN state when deviceState is missing', () => {
    expect(parseStatus({ dishGetStatus: {} })!.state).toBe('UNKNOWN');
  });

  it('maps alert flags to string array', () => {
    const raw = {
      dishGetStatus: {
        alerts: {
          motorsStuck: true,
          thermalShutdown: true,
          thermalThrottle: false,
          unexpectedLocation: false,
          slowEthernetSpeeds: false,
        },
      },
    };
    expect(parseStatus(raw)!.alerts).toEqual(['motors_stuck', 'thermal_shutdown']);
  });

  it('uses safe defaults when optional fields are missing', () => {
    const s = parseStatus({ dishGetStatus: {} })!;
    expect(s.deviceId).toBe('unknown');
    expect(s.downlinkThroughputBps).toBe(0);
    expect(s.gpsSats).toBe(0);
    expect(s.snrAboveNoiseFloor).toBe(false);
    expect(s.alerts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and verify tests fail**

```bash
npx vitest run tests/status.test.ts
```

Expected: `Error: Cannot find module '../src/status'`

- [ ] **Step 3: Implement `parseStatus()` in `src/status.ts`**

```typescript
import type { DishStatus } from './types';
import { getHandle } from './transport';

export function parseStatus(raw: unknown): DishStatus | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (raw as any)?.dishGetStatus;
  if (!s) return null;

  const alerts: string[] = [];
  if (s.alerts?.motorsStuck) alerts.push('motors_stuck');
  if (s.alerts?.thermalThrottle) alerts.push('thermal_throttle');
  if (s.alerts?.thermalShutdown) alerts.push('thermal_shutdown');
  if (s.alerts?.unexpectedLocation) alerts.push('unexpected_location');
  if (s.alerts?.slowEthernetSpeeds) alerts.push('slow_ethernet_speeds');

  return {
    deviceId: s.deviceInfo?.id ?? 'unknown',
    hardwareVersion: s.deviceInfo?.hardwareVersion ?? 'unknown',
    softwareVersion: s.deviceInfo?.softwareVersion ?? 'unknown',
    countryCode: s.deviceInfo?.countryCode ?? '',
    bootcount: s.deviceInfo?.bootcount ?? 0,
    uptimeSeconds: Number(s.deviceState?.uptimeS ?? 0),
    state: s.deviceState ? 'CONNECTED' : 'UNKNOWN',
    downlinkThroughputBps: s.downlinkThroughputBps ?? 0,
    uplinkThroughputBps: s.uplinkThroughputBps ?? 0,
    popPingLatencyMs: s.popPingLatencyMs ?? 0,
    popPingDropRate: s.popPingDropRate ?? 0,
    obstructionPercentTime: (s.obstructionStats?.fractionObstructed ?? 0) * 100,
    currentlyObstructed: s.obstructionStats?.currentlyObstructed ?? false,
    snrAboveNoiseFloor: s.isSnrAboveNoiseFloor ?? false,
    snrPersistentlyLow: s.isSnrPersistentlyLow ?? false,
    boresightAzimuthDeg: s.boresightAzimuthDeg ?? 0,
    boresightElevationDeg: s.boresightElevationDeg ?? 0,
    gpsValid: s.gpsStats?.gpsValid ?? false,
    gpsSats: s.gpsStats?.gpsSats ?? 0,
    ethSpeedMbps: s.ethSpeedMbps ?? 0,
    alerts,
  };
}

export function getStatus(): Promise<DishStatus | null> {
  const handle = getHandle();
  if (!handle) return Promise.resolve(null);
  return new Promise((resolve) => {
    handle({ getStatus: {} }, (err, response) => {
      if (err) { resolve(null); return; }
      resolve(parseStatus(response));
    });
  });
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npx vitest run tests/status.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/status.ts tests/status.test.ts
git commit -m "feat: add parseStatus() and getStatus() with full field mapping"
```

---

## Task 6: Status — getStatus() integration tests

**Files:**
- Modify: `tests/status.test.ts`

- [ ] **Step 1: Add `getStatus()` integration tests**

Append to `tests/status.test.ts`:

```typescript
describe('getStatus()', () => {
  afterEach(() => clearHandle());

  it('returns null when not connected', async () => {
    expect(await getStatus()).toBeNull();
  });

  it('calls handle with { getStatus: {} } and returns parsed status', async () => {
    const raw = {
      dishGetStatus: {
        deviceInfo: { id: 'test-id', hardwareVersion: '4.0', softwareVersion: '1.0', countryCode: 'FR', bootcount: 1 },
        deviceState: { uptimeS: 100 },
        isSnrAboveNoiseFloor: true,
        alerts: {},
      },
    };
    let capturedRequest: unknown;
    setHandle((req, cb) => { capturedRequest = req; cb(null, raw); });

    const status = await getStatus();

    expect(capturedRequest).toEqual({ getStatus: {} });
    expect(status).not.toBeNull();
    expect(status!.deviceId).toBe('test-id');
    expect(status!.snrAboveNoiseFloor).toBe(true);
  });

  it('returns null when handle returns an error', async () => {
    setHandle((_req, cb) => cb(new Error('network error') as any, null));
    expect(await getStatus()).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify new tests fail**

```bash
npx vitest run tests/status.test.ts
```

Expected: the 3 new `getStatus()` tests fail (function not imported yet in test).

Add the missing import at the top of the test file — `getStatus` is already exported from `src/status.ts`, so just verify the import line includes it:

```typescript
import { parseStatus, getStatus } from '../src/status';
```

- [ ] **Step 3: Run again and verify all pass**

```bash
npx vitest run tests/status.test.ts
```

Expected: 8 passing.

- [ ] **Step 4: Commit**

```bash
git add tests/status.test.ts
git commit -m "test: add getStatus() integration tests with injected transport"
```

---

## Task 7: History parsing — unit tests

**Files:**
- Create: `tests/history.test.ts`
- Create: `src/history.ts`

- [ ] **Step 1: Write failing unit tests for `parseHistory()`**

```typescript
// tests/history.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { parseHistory, getHistory } from '../src/history';
import { setHandle, clearHandle } from '../src/transport';

describe('parseHistory()', () => {
  it('maps dishGetHistory fields to DishHistory', () => {
    const raw = {
      dishGetHistory: {
        current: 3600,
        popPingLatencyMs: [25.0, 28.0, 31.0],
        popPingDropRate: [0.001, 0.002, 0.0],
        downlinkThroughputBps: [100_000_000, 110_000_000, 95_000_000],
        uplinkThroughputBps: [10_000_000, 12_000_000, 9_000_000],
      },
    };

    const h = parseHistory(raw);

    expect(h).not.toBeNull();
    expect(h!.current).toBe(3600);
    expect(h!.pingLatencyMs).toEqual([25.0, 28.0, 31.0]);
    expect(h!.pingDropRate).toEqual([0.001, 0.002, 0.0]);
    expect(h!.downlinkThroughputBps).toEqual([100_000_000, 110_000_000, 95_000_000]);
    expect(h!.uplinkThroughputBps).toEqual([10_000_000, 12_000_000, 9_000_000]);
  });

  it('returns null when dishGetHistory is absent', () => {
    expect(parseHistory(null)).toBeNull();
    expect(parseHistory({})).toBeNull();
    expect(parseHistory({ dishGetStatus: {} })).toBeNull();
  });

  it('uses empty arrays when array fields are missing', () => {
    const h = parseHistory({ dishGetHistory: { current: 0 } })!;
    expect(h.pingLatencyMs).toEqual([]);
    expect(h.pingDropRate).toEqual([]);
    expect(h.downlinkThroughputBps).toEqual([]);
    expect(h.uplinkThroughputBps).toEqual([]);
  });
});

describe('getHistory()', () => {
  afterEach(() => clearHandle());

  it('returns null when not connected', async () => {
    expect(await getHistory()).toBeNull();
  });

  it('calls handle with { getHistory: {} } and returns parsed history', async () => {
    const raw = {
      dishGetHistory: {
        current: 10,
        popPingLatencyMs: [30.0],
        popPingDropRate: [0.0],
        downlinkThroughputBps: [80_000_000],
        uplinkThroughputBps: [8_000_000],
      },
    };
    let capturedRequest: unknown;
    setHandle((req, cb) => { capturedRequest = req; cb(null, raw); });

    const history = await getHistory();

    expect(capturedRequest).toEqual({ getHistory: {} });
    expect(history).not.toBeNull();
    expect(history!.pingLatencyMs).toEqual([30.0]);
  });

  it('returns null when handle returns an error', async () => {
    setHandle((_req, cb) => cb(new Error('network error') as any, null));
    expect(await getHistory()).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify tests fail**

```bash
npx vitest run tests/history.test.ts
```

Expected: `Error: Cannot find module '../src/history'`

- [ ] **Step 3: Implement `src/history.ts`**

```typescript
import type { DishHistory } from './types';
import { getHandle } from './transport';

export function parseHistory(raw: unknown): DishHistory | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = (raw as any)?.dishGetHistory;
  if (!h) return null;

  return {
    current: Number(h.current ?? 0),
    pingLatencyMs: h.popPingLatencyMs ?? [],
    pingDropRate: h.popPingDropRate ?? [],
    downlinkThroughputBps: h.downlinkThroughputBps ?? [],
    uplinkThroughputBps: h.uplinkThroughputBps ?? [],
  };
}

export function getHistory(): Promise<DishHistory | null> {
  const handle = getHandle();
  if (!handle) return Promise.resolve(null);
  return new Promise((resolve) => {
    handle({ getHistory: {} }, (err, response) => {
      if (err) { resolve(null); return; }
      resolve(parseHistory(response));
    });
  });
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npx vitest run tests/history.test.ts
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/history.ts tests/history.test.ts
git commit -m "feat: add parseHistory() and getHistory() with renamed fields"
```

---

## Task 8: Extend proto — reboot and speedtest

**Files:**
- Modify: `proto/dish.proto`

- [ ] **Step 1: Extract proto field numbers from the dish using grpcurl**

If you have a live Starlink dish at `192.168.100.1`:

```bash
# Install grpcurl if needed: brew install grpcurl
grpcurl -plaintext 192.168.100.1:9200 describe SpaceX.API.Device.Request
```

Look for `reboot` and `startSpeedtest` entries in the oneof to get their field numbers. If the dish is unavailable, the known community-verified field numbers (from sparky8512/starlink-grpc-tools analysis) are:
- `RebootRequest reboot = 1005;`
- `StartSpeedtestRequest start_speedtest = 1003;`
- `GetSpeedtestResultRequest get_speedtest_result = 1027;`
- `RebootResponse reboot = 2005;` in Response
- `StartSpeedtestResponse start_speedtest = 2001;` in Response
- `GetSpeedtestResultResponse get_speedtest_result = 2034;` in Response

Verify these match what grpcurl returns from your dish before proceeding.

- [ ] **Step 2: Add reboot and speedtest messages to `proto/dish.proto`**

```protobuf
syntax = "proto3";
package SpaceX.API.Device;

service Device {
  rpc Handle (Request) returns (Response);
}

message Request {
  uint64 id = 1;
  string target_id = 13;
  uint64 epoch_id = 14;
  oneof request {
    GetStatusRequest get_status = 1004;
    GetHistoryRequest get_history = 1007;
    RebootRequest reboot = 1005;
    StartSpeedtestRequest start_speedtest = 1003;
    GetSpeedtestResultRequest get_speedtest_result = 1027;
  }
}

message GetStatusRequest {}
message GetHistoryRequest {}
message RebootRequest {}
message StartSpeedtestRequest {}
message GetSpeedtestResultRequest {}

message Response {
  uint64 id = 1;
  uint64 api_version = 3;
  oneof response {
    DishGetStatusResponse dish_get_status = 2004;
    DishGetHistoryResponse dish_get_history = 2006;
    RebootResponse reboot = 2005;
    StartSpeedtestResponse start_speedtest = 2001;
    GetSpeedtestResultResponse get_speedtest_result = 2034;
  }
}

message RebootResponse {}

message StartSpeedtestResponse {}

message GetSpeedtestResultResponse {
  float download_bps = 1;
  float upload_bps = 2;
  float latency_ms = 3;
  bool running = 4;
}

message DishGetStatusResponse {
  DeviceInfo device_info = 1;
  DeviceState device_state = 2;
  float pop_ping_drop_rate = 1003;
  DishObstructionStats obstruction_stats = 1004;
  DishAlerts alerts = 1005;
  float downlink_throughput_bps = 1007;
  float uplink_throughput_bps = 1008;
  float pop_ping_latency_ms = 1009;
  float boresight_azimuth_deg = 1011;
  float boresight_elevation_deg = 1012;
  DishGpsStats gps_stats = 1015;
  int32 eth_speed_mbps = 1016;
  bool is_snr_above_noise_floor = 1018;
  bool is_snr_persistently_low = 1022;
}

message DeviceInfo {
  string id = 1;
  string hardware_version = 2;
  string software_version = 3;
  string country_code = 4;
  int32 bootcount = 5;
}

message DeviceState {
  uint64 uptime_s = 3;
}

message DishObstructionStats {
  float fraction_obstructed = 1;
  float valid_s = 4;
  bool currently_obstructed = 5;
  float time_obstructed = 9;
  uint32 patches_valid = 10;
}

message DishAlerts {
  bool motors_stuck = 1;
  bool thermal_shutdown = 2;
  bool thermal_throttle = 3;
  bool unexpected_location = 8;
  bool slow_ethernet_speeds = 15;
}

message DishGpsStats {
  bool gps_valid = 1;
  int32 gps_sats = 2;
}

message DishGetHistoryResponse {
  uint64 current = 1;
  repeated float pop_ping_drop_rate = 1001;
  repeated float pop_ping_latency_ms = 1002;
  repeated float downlink_throughput_bps = 1003;
  repeated float uplink_throughput_bps = 1004;
}
```

- [ ] **Step 3: Verify existing tests still pass**

```bash
npx vitest run
```

Expected: all tests still pass (proto changes don't affect unit tests that use injected transport).

- [ ] **Step 4: Commit**

```bash
git add proto/dish.proto
git commit -m "feat: extend proto with reboot and speedtest messages"
```

---

## Task 9: Control commands — reboot and speedTest

**Files:**
- Create: `src/control.ts`
- Create: `tests/control.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/control.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { reboot, speedTest } from '../src/control';
import { setHandle, clearHandle } from '../src/transport';

describe('reboot()', () => {
  afterEach(() => clearHandle());

  it('returns false when not connected', async () => {
    expect(await reboot()).toBe(false);
  });

  it('sends { reboot: {} } and returns true on success', async () => {
    let capturedRequest: unknown;
    setHandle((req, cb) => { capturedRequest = req; cb(null, { reboot: {} }); });

    const result = await reboot();

    expect(capturedRequest).toEqual({ reboot: {} });
    expect(result).toBe(true);
  });

  it('returns false on gRPC error', async () => {
    setHandle((_req, cb) => cb(new Error('connection refused') as any, null));
    expect(await reboot()).toBe(false);
  });
});

describe('speedTest()', () => {
  afterEach(() => clearHandle());

  it('returns null when not connected', async () => {
    expect(await speedTest()).toBeNull();
  });

  it('sends start + poll and returns SpeedTestResult', async () => {
    const requests: unknown[] = [];
    setHandle((req: any, cb) => {
      requests.push(req);
      if (req.startSpeedtest !== undefined) {
        cb(null, { startSpeedtest: {} });
      } else if (req.getSpeedtestResult !== undefined) {
        cb(null, {
          getSpeedtestResult: { downloadBps: 100_000_000, uploadBps: 10_000_000, latencyMs: 25.0, running: false }
        });
      }
    });

    const result = await speedTest();

    expect(result).not.toBeNull();
    expect(result!.downloadMbps).toBeCloseTo(100);
    expect(result!.uploadMbps).toBeCloseTo(10);
    expect(result!.latencyMs).toBe(25.0);
    expect(requests[0]).toEqual({ startSpeedtest: {} });
    expect(requests[1]).toEqual({ getSpeedtestResult: {} });
  });

  it('returns null on gRPC error during start', async () => {
    setHandle((_req, cb) => cb(new Error('error') as any, null));
    expect(await speedTest()).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify they fail**

```bash
npx vitest run tests/control.test.ts
```

Expected: `Error: Cannot find module '../src/control'`

- [ ] **Step 3: Implement `src/control.ts`**

```typescript
import type { SpeedTestResult } from './types';
import { getHandle } from './transport';

export function reboot(): Promise<boolean> {
  const handle = getHandle();
  if (!handle) return Promise.resolve(false);
  return new Promise((resolve) => {
    handle({ reboot: {} }, (err) => resolve(!err));
  });
}

export function speedTest(timeoutMs = 30_000): Promise<SpeedTestResult | null> {
  const handle = getHandle();
  if (!handle) return Promise.resolve(null);

  return new Promise((resolve) => {
    handle({ startSpeedtest: {} }, (err) => {
      if (err) { resolve(null); return; }

      const deadline = Date.now() + timeoutMs;

      function poll() {
        if (Date.now() > deadline) { resolve(null); return; }

        handle!({ getSpeedtestResult: {} }, (err2, response) => {
          if (err2) { resolve(null); return; }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = (response as any)?.getSpeedtestResult;
          if (!r) { resolve(null); return; }
          if (r.running) {
            setTimeout(poll, 500);
            return;
          }
          resolve({
            downloadMbps: (r.downloadBps ?? 0) / 1_000_000,
            uploadMbps: (r.uploadBps ?? 0) / 1_000_000,
            latencyMs: r.latencyMs ?? 0,
          });
        });
      }

      poll();
    });
  });
}
```

- [ ] **Step 4: Run and verify all tests pass**

```bash
npx vitest run tests/control.test.ts
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/control.ts tests/control.test.ts
git commit -m "feat: add reboot() and speedTest() control commands"
```

---

## Task 10: Mock mode

**Files:**
- Create: `src/mock.ts`
- Create: `tests/mock.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/mock.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { useMock } from '../src/mock';
import { clearHandle, isConnected } from '../src/transport';
import { getStatus } from '../src/status';
import { getHistory } from '../src/history';
import { reboot, speedTest } from '../src/control';

describe('useMock()', () => {
  afterEach(() => clearHandle());

  it('sets isConnected() to true', () => {
    useMock();
    expect(isConnected()).toBe(true);
  });

  it('getStatus() returns a valid DishStatus', async () => {
    useMock();
    const s = await getStatus();
    expect(s).not.toBeNull();
    expect(typeof s!.deviceId).toBe('string');
    expect(typeof s!.snrAboveNoiseFloor).toBe('boolean');
    expect(typeof s!.downlinkThroughputBps).toBe('number');
    expect(s!.downlinkThroughputBps).toBeGreaterThan(0);
    expect(Array.isArray(s!.alerts)).toBe(true);
  });

  it('getHistory() returns a valid DishHistory', async () => {
    useMock();
    const h = await getHistory();
    expect(h).not.toBeNull();
    expect(Array.isArray(h!.pingLatencyMs)).toBe(true);
    expect(h!.pingLatencyMs.length).toBe(60);
    expect(h!.pingLatencyMs.every((v) => v > 0)).toBe(true);
    expect(Array.isArray(h!.downlinkThroughputBps)).toBe(true);
  });

  it('reboot() returns true', async () => {
    useMock();
    expect(await reboot()).toBe(true);
  });

  it('speedTest() returns a valid SpeedTestResult', async () => {
    useMock();
    const r = await speedTest();
    expect(r).not.toBeNull();
    expect(r!.downloadMbps).toBeGreaterThan(0);
    expect(r!.uploadMbps).toBeGreaterThan(0);
    expect(r!.latencyMs).toBeGreaterThan(0);
  });

  it('faultRate:1 causes getStatus() to return null', async () => {
    useMock({ faultRate: 1 });
    expect(await getStatus()).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify tests fail**

```bash
npx vitest run tests/mock.test.ts
```

Expected: `Error: Cannot find module '../src/mock'`

- [ ] **Step 3: Implement `src/mock.ts`**

```typescript
import { setHandle } from './transport';
import type { MockOptions } from './types';

function smoothNoise(t: number, ...freqs: number[]): number {
  return freqs.reduce((s, f) => s + Math.sin(t * f), 0) / freqs.length;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function buildStatusResponse(t: number) {
  const dlMbps = clamp(120 + 100 * smoothNoise(t, 0.05, 0.13, 0.31), 25, 220);
  const ulMbps = clamp(12.5 + 7.5 * smoothNoise(t, 0.07, 0.17, 0.41), 5, 20);
  const ping = clamp(38 + 13 * smoothNoise(t, 0.1, 0.23, 0.51), 25, 200);
  const drop = clamp(0.005 + 0.01 * smoothNoise(t, 0.08, 0.19), 0, 0.05);
  return {
    dishGetStatus: {
      deviceInfo: { id: 'ut01000000-00000-demo0', hardwareVersion: 'rev4_proto3', softwareVersion: '2025.12.0.mr36752-prod', countryCode: 'US', bootcount: 1 },
      deviceState: { uptimeS: Math.floor(t) },
      downlinkThroughputBps: dlMbps * 1_000_000,
      uplinkThroughputBps: ulMbps * 1_000_000,
      popPingLatencyMs: ping,
      popPingDropRate: drop,
      obstructionStats: { fractionObstructed: 0, currentlyObstructed: false },
      isSnrAboveNoiseFloor: true,
      isSnrPersistentlyLow: false,
      boresightAzimuthDeg: 0,
      boresightElevationDeg: 0,
      gpsStats: { gpsValid: true, gpsSats: 8 + Math.floor(Math.random() * 4) },
      ethSpeedMbps: 1000,
      alerts: {},
    },
  };
}

function buildHistoryResponse(t: number) {
  const samples = 60;
  const pingLatencyMs: number[] = [];
  const pingDropRate: number[] = [];
  const downlinkThroughputBps: number[] = [];
  const uplinkThroughputBps: number[] = [];

  for (let i = 0; i < samples; i++) {
    const ti = t - (samples - i);
    pingLatencyMs.push(clamp(38 + 13 * smoothNoise(ti, 0.1, 0.23, 0.51), 25, 60));
    pingDropRate.push(clamp(0.005 + 0.01 * smoothNoise(ti, 0.08, 0.19), 0, 0.05));
    downlinkThroughputBps.push(clamp(120 + 100 * smoothNoise(ti, 0.05, 0.13, 0.31), 25, 220) * 1_000_000);
    uplinkThroughputBps.push(clamp(12.5 + 7.5 * smoothNoise(ti, 0.07, 0.17, 0.41), 5, 20) * 1_000_000);
  }

  return { dishGetHistory: { current: Math.floor(t), popPingLatencyMs: pingLatencyMs, popPingDropRate: pingDropRate, downlinkThroughputBps, uplinkThroughputBps } };
}

export function useMock(options: MockOptions = {}): void {
  const { faultRate = 0 } = options;
  const start = Date.now();

  setHandle((request: any, callback) => {
    if (Math.random() < faultRate) {
      callback(new Error('Mock fault injected') as any, null);
      return;
    }
    const t = (Date.now() - start) / 1000;

    if (request.getStatus !== undefined) {
      callback(null, buildStatusResponse(t));
    } else if (request.getHistory !== undefined) {
      callback(null, buildHistoryResponse(t));
    } else if (request.reboot !== undefined) {
      callback(null, { reboot: {} });
    } else if (request.startSpeedtest !== undefined) {
      callback(null, { startSpeedtest: {} });
    } else if (request.getSpeedtestResult !== undefined) {
      callback(null, { getSpeedtestResult: { downloadBps: 95_000_000, uploadBps: 11_000_000, latencyMs: 27.0, running: false } });
    } else {
      callback(new Error('Unknown mock request') as any, null);
    }
  });
}
```

- [ ] **Step 4: Run and verify all tests pass**

```bash
npx vitest run tests/mock.test.ts
```

Expected: 6 passing.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/mock.ts tests/mock.test.ts
git commit -m "feat: add useMock() with realistic generated telemetry data"
```

---

## Task 11: Wire public index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Write `src/index.ts`**

```typescript
export type { DishStatus, DishHistory, SpeedTestResult, MockOptions } from './types';
export { initClient, closeClient } from './client';
export { isConnected } from './transport';
export { getStatus } from './status';
export { getHistory } from './history';
export { reboot, speedTest } from './control';
export { useMock } from './mock';
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: `dist/` folder created with `.js`, `.d.ts`, and `.d.ts.map` files.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire public index.ts re-exports"
```

---

## Task 12: CLI

**Files:**
- Create: `cli/index.ts`
- Create: `tests/cli.test.ts`

- [ ] **Step 1: Write failing CLI output tests**

```typescript
// tests/cli.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { formatStatus, formatHistory, formatSpeedTest } from '../cli/format';
import type { DishStatus, DishHistory, SpeedTestResult } from '../src/types';

const sampleStatus: DishStatus = {
  deviceId: 'ut01-test',
  hardwareVersion: '4.0',
  softwareVersion: '2025.12.0',
  countryCode: 'US',
  bootcount: 3,
  uptimeSeconds: 86400 * 3 + 3600 * 4,
  state: 'CONNECTED',
  downlinkThroughputBps: 87_300_000,
  uplinkThroughputBps: 14_200_000,
  popPingLatencyMs: 28.4,
  popPingDropRate: 0.0002,
  obstructionPercentTime: 0.3,
  currentlyObstructed: false,
  snrAboveNoiseFloor: true,
  snrPersistentlyLow: false,
  boresightAzimuthDeg: 192,
  boresightElevationDeg: 47,
  gpsValid: true,
  gpsSats: 9,
  ethSpeedMbps: 1000,
  alerts: [],
};

describe('formatStatus()', () => {
  it('includes download and upload Mbps', () => {
    const out = formatStatus(sampleStatus);
    expect(out).toContain('87.3');
    expect(out).toContain('14.2');
  });

  it('includes ping latency', () => {
    expect(formatStatus(sampleStatus)).toContain('28.4');
  });

  it('includes SNR above noise floor text', () => {
    expect(formatStatus(sampleStatus)).toContain('above noise floor');
  });

  it('includes uptime formatted as days/hours', () => {
    expect(formatStatus(sampleStatus)).toContain('3d 4h');
  });

  it('shows "none" when no alerts', () => {
    expect(formatStatus(sampleStatus)).toContain('none');
  });

  it('shows alert names when present', () => {
    const s = { ...sampleStatus, alerts: ['thermal_throttle'] };
    expect(formatStatus(s)).toContain('thermal_throttle');
  });
});

const sampleResult: SpeedTestResult = { downloadMbps: 95.4, uploadMbps: 11.2, latencyMs: 27.0 };

describe('formatSpeedTest()', () => {
  it('includes download and upload Mbps', () => {
    const out = formatSpeedTest(sampleResult);
    expect(out).toContain('95.4');
    expect(out).toContain('11.2');
  });
});
```

- [ ] **Step 2: Run and verify tests fail**

```bash
npx vitest run tests/cli.test.ts
```

Expected: `Error: Cannot find module '../cli/format'`

- [ ] **Step 3: Implement `cli/format.ts`**

```typescript
import type { DishStatus, DishHistory, SpeedTestResult } from '../src/types';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

export function formatStatus(s: DishStatus): string {
  const dl = (s.downlinkThroughputBps / 1_000_000).toFixed(1);
  const ul = (s.uplinkThroughputBps / 1_000_000).toFixed(1);
  const drop = (s.popPingDropRate * 100).toFixed(2);
  const snr = s.snrAboveNoiseFloor ? 'above noise floor' : 'BELOW noise floor';
  const alerts = s.alerts.length ? s.alerts.join(', ') : 'none';
  const bar = '━'.repeat(51);

  return [
    `Starlink Dish  •  hw: ${s.hardwareVersion}  sw: ${s.softwareVersion}  up: ${formatUptime(s.uptimeSeconds)}`,
    bar,
    ` Download    ${dl} Mbps   Upload    ${ul} Mbps`,
    ` Ping        ${s.popPingLatencyMs.toFixed(1)} ms     Drop      ${drop}%`,
    ` SNR         ${snr}`,
    ` Obstruction ${s.obstructionPercentTime.toFixed(1)}%        GPS sats  ${s.gpsSats}`,
    ` Boresight   Az ${s.boresightAzimuthDeg.toFixed(0)}°  El ${s.boresightElevationDeg.toFixed(0)}°`,
    bar,
    ` Alerts: ${alerts}`,
  ].join('\n');
}

export function formatHistory(h: { pingLatencyMs: number[]; downlinkThroughputBps: number[] }): string {
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const dlAvg = (avg(h.downlinkThroughputBps) / 1_000_000).toFixed(1);
  const pingAvg = avg(h.pingLatencyMs).toFixed(1);
  return [
    `Last ${h.pingLatencyMs.length} samples:`,
    ` Avg download: ${dlAvg} Mbps`,
    ` Avg ping:     ${pingAvg} ms`,
  ].join('\n');
}

export function formatSpeedTest(r: SpeedTestResult): string {
  return [
    'Speed Test Results:',
    ` Download: ${r.downloadMbps.toFixed(1)} Mbps`,
    ` Upload:   ${r.uploadMbps.toFixed(1)} Mbps`,
    ` Latency:  ${r.latencyMs.toFixed(1)} ms`,
  ].join('\n');
}
```

- [ ] **Step 4: Run and verify format tests pass**

```bash
npx vitest run tests/cli.test.ts
```

Expected: 7 passing.

- [ ] **Step 5: Implement `cli/index.ts`**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { initClient, closeClient, useMock, getStatus, getHistory, reboot, speedTest } from '../src/index';
import { formatStatus, formatHistory, formatSpeedTest } from './format';

const program = new Command();

program
  .name('starlink-dish')
  .description('Starlink dish local gRPC client')
  .version('0.1.0')
  .option('--address <addr>', 'dish address', '192.168.100.1:9200')
  .option('--mock', 'use mock data (no dish required)');

async function connect(opts: { address: string; mock?: boolean }): Promise<boolean> {
  if (opts.mock) { useMock(); return true; }
  const ok = await initClient(opts.address);
  if (!ok) { console.error(`Cannot connect to dish at ${opts.address}`); }
  return ok;
}

program
  .command('status')
  .description('Show current dish status')
  .option('--json', 'output raw JSON')
  .action(async (cmdOpts) => {
    const opts = program.opts<{ address: string; mock?: boolean }>();
    if (!await connect(opts)) process.exit(1);
    const s = await getStatus();
    closeClient();
    if (!s) { console.error('Failed to get status'); process.exit(1); }
    console.log(cmdOpts.json ? JSON.stringify(s, null, 2) : formatStatus(s));
  });

program
  .command('history')
  .description('Show telemetry history')
  .option('--json', 'output raw JSON')
  .action(async (cmdOpts) => {
    const opts = program.opts<{ address: string; mock?: boolean }>();
    if (!await connect(opts)) process.exit(1);
    const h = await getHistory();
    closeClient();
    if (!h) { console.error('Failed to get history'); process.exit(1); }
    console.log(cmdOpts.json ? JSON.stringify(h, null, 2) : formatHistory(h));
  });

program
  .command('reboot')
  .description('Reboot the dish (prompts for confirmation)')
  .action(async () => {
    const opts = program.opts<{ address: string; mock?: boolean }>();
    if (!opts.mock) {
      process.stdout.write('Reboot dish? This will drop your connection. [y/N] ');
      const line = await new Promise<string>((res) => {
        process.stdin.once('data', (d) => res(d.toString().trim()));
      });
      if (line.toLowerCase() !== 'y') { console.log('Aborted.'); process.exit(0); }
    }
    if (!await connect(opts)) process.exit(1);
    const ok = await reboot();
    closeClient();
    console.log(ok ? 'Reboot command sent.' : 'Reboot failed.');
    process.exit(ok ? 0 : 1);
  });

program
  .command('speed-test')
  .description('Run a speed test')
  .option('--json', 'output raw JSON')
  .action(async (cmdOpts) => {
    const opts = program.opts<{ address: string; mock?: boolean }>();
    if (!await connect(opts)) process.exit(1);
    console.log('Running speed test...');
    const r = await speedTest();
    closeClient();
    if (!r) { console.error('Speed test failed'); process.exit(1); }
    console.log(cmdOpts.json ? JSON.stringify(r, null, 2) : formatSpeedTest(r));
  });

program.parseAsync(process.argv);
```

- [ ] **Step 6: Build and test the CLI manually in mock mode**

```bash
npm run build
node dist/cli/index.js --mock status
node dist/cli/index.js --mock history
node dist/cli/index.js --mock speed-test
node dist/cli/index.js --mock status --json
```

Expected: formatted output for each command with no errors.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add cli/ tests/cli.test.ts
git commit -m "feat: add CLI with status, history, reboot, speed-test commands"
```

---

## Task 13: CI and publish workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npm run build
```

- [ ] **Step 2: Write `.github/workflows/publish.yml`**

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npm run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add CI and npm publish workflows"
```

---

## Task 14: Publish to npm

- [ ] **Step 1: Create an npm account and obtain an access token**

Go to https://www.npmjs.com → Account → Access Tokens → Generate New Token (Automation type). Copy the token.

- [ ] **Step 2: Add the token to GitHub repo secrets**

In the GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- Name: `NPM_TOKEN`
- Value: the token from Step 1

- [ ] **Step 3: Final build and local publish dry-run**

```bash
npm run build
npm pack --dry-run
```

Expected: lists files that would be published (`dist/`, `proto/`, `README.md`). Verify no source files or test files are included.

- [ ] **Step 4: Create GitHub release**

```bash
git tag v0.1.0
git push origin main --tags
```

Then on GitHub: Releases → Create release from tag `v0.1.0`. Publishing the release triggers the publish workflow automatically.

- [ ] **Step 5: Verify package is on npm**

```bash
npm info starlink-dish
```

Expected: package metadata with version `0.1.0`.
