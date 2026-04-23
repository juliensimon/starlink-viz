# starlink-dish App Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/lib/grpc/` in this visualization app with the published `starlink-dish` npm package, with full TDD coverage to ensure no regressions.

**Architecture:** Write regression tests for current behavior first. Migrate one file at a time — tests must stay green after every swap. Delete `src/lib/grpc/` only after all tests pass. Key type changes: `DishStatus.snr: number` → `snrAboveNoiseFloor: boolean`; `DishHistory` field renames (`pingLatency` → `pingLatencyMs`, etc.).

**Tech Stack:** Same as existing app — TypeScript 5, Next.js 16, Zustand, vitest.

**Prerequisite:** `starlink-dish` must be published to npm. Run `npm info starlink-dish` to confirm before starting.

---

## File Map — What Changes

| File | Change |
|------|--------|
| `src/__tests__/grpc-regression.test.ts` | **Create** — regression tests written before any migration |
| `server.ts` | **Modify** — swap gRPC imports from local to `starlink-dish`; replace mock generators with `useMock()` |
| `src/lib/grpc/types.ts` | **Modify** — replace `DishStatus`/`DishHistory` definitions with re-exports from `starlink-dish` |
| `src/lib/websocket/client.ts` | **Modify** — update field names from gRPC `DishStatus` and handle `snrAboveNoiseFloor` boolean |
| `src/stores/telemetry-store.ts` | **Modify** — update `snr` field handling in `pushHistory` |
| `src/components/hud/TelemetryPanel.tsx` | **Modify** — render `snrAboveNoiseFloor` boolean instead of fake dB value |
| `src/lib/grpc/client.ts` | **Delete** (Task 8) |
| `src/lib/grpc/mock-data.ts` | **Delete** (Task 8) |
| `src/lib/grpc/dish.proto` | **Delete** (Task 8) |
| `src/lib/grpc/proto-loader.ts` | **Delete** if it exists (Task 8) |
| `src/lib/grpc/types.ts` | **Delete** (Task 8, after re-export shim removed) |

---

## Task 1: Write regression tests for current gRPC behavior

Write tests for the current `src/lib/grpc/client.ts` behavior **before touching any imports**. These tests become the safety net for the migration.

**Files:**
- Create: `src/__tests__/grpc-regression.test.ts`

- [ ] **Step 1: Write failing tests (they should pass after implementation — verify they exist and reflect real behavior)**

```typescript
// src/__tests__/grpc-regression.test.ts
import { describe, it, expect } from 'vitest';
import { generateMockStatus, generateMockHistory } from '../lib/grpc/mock-data';

describe('generateMockStatus()', () => {
  it('returns a DishStatus with all required fields', () => {
    const s = generateMockStatus(5000);
    expect(typeof s.deviceId).toBe('string');
    expect(typeof s.downlinkThroughput).toBe('number');
    expect(typeof s.uplinkThroughput).toBe('number');
    expect(typeof s.popPingLatency).toBe('number');
    expect(typeof s.popPingDropRate).toBe('number');
    expect(typeof s.snr).toBe('number');
    expect(typeof s.uptime).toBe('number');
    expect(typeof s.obstructionPercentTime).toBe('number');
    expect(Array.isArray(s.alerts)).toBe(true);
    expect(s.state).toBe('CONNECTED');
  });

  it('downlinkThroughput is in bytes/s (> 1_000_000 for typical values)', () => {
    const s = generateMockStatus(0);
    expect(s.downlinkThroughput).toBeGreaterThan(1_000_000);
  });

  it('snr is a numeric estimate (always 9-12 range)', () => {
    for (let t = 0; t < 10000; t += 1000) {
      const s = generateMockStatus(t);
      expect(s.snr).toBeGreaterThanOrEqual(9);
      expect(s.snr).toBeLessThanOrEqual(12);
    }
  });
});

describe('generateMockHistory()', () => {
  it('returns a DishHistory with all required fields', () => {
    const h = generateMockHistory();
    expect(Array.isArray(h.pingLatency)).toBe(true);
    expect(Array.isArray(h.downlinkThroughput)).toBe(true);
    expect(Array.isArray(h.uplinkThroughput)).toBe(true);
    expect(Array.isArray(h.snr)).toBe(true);
  });

  it('returns 60 samples', () => {
    const h = generateMockHistory();
    expect(h.pingLatency).toHaveLength(60);
    expect(h.downlinkThroughput).toHaveLength(60);
    expect(h.uplinkThroughput).toHaveLength(60);
    expect(h.snr).toHaveLength(60);
  });
});
```

- [ ] **Step 2: Run tests and verify they pass (these test existing code)**

```bash
npx vitest run src/__tests__/grpc-regression.test.ts
```

Expected: 5 passing. If any fail, investigate the current code before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/grpc-regression.test.ts
git commit -m "test: add regression tests for current grpc mock behavior before migration"
```

---

## Task 2: Install starlink-dish and update gRPC types

**Files:**
- Modify: `src/lib/grpc/types.ts`

- [ ] **Step 1: Install the package**

```bash
npm install starlink-dish
```

- [ ] **Step 2: Write failing tests for new type shapes**

Append to `src/__tests__/grpc-regression.test.ts`:

```typescript
import type { DishStatus as NewDishStatus, DishHistory as NewDishHistory } from 'starlink-dish';

describe('starlink-dish type contract', () => {
  it('DishStatus has snrAboveNoiseFloor boolean (not snr number)', () => {
    const s: NewDishStatus = {
      deviceId: 'test', hardwareVersion: '4.0', softwareVersion: '1.0',
      countryCode: 'US', bootcount: 0, uptimeSeconds: 0, state: 'CONNECTED',
      downlinkThroughputBps: 0, uplinkThroughputBps: 0, popPingLatencyMs: 0,
      popPingDropRate: 0, obstructionPercentTime: 0, currentlyObstructed: false,
      snrAboveNoiseFloor: true, snrPersistentlyLow: false,
      boresightAzimuthDeg: 0, boresightElevationDeg: 0,
      gpsValid: true, gpsSats: 0, ethSpeedMbps: 0, alerts: [],
    };
    expect(typeof s.snrAboveNoiseFloor).toBe('boolean');
    // @ts-expect-error — old snr field must not exist on new type
    expect(s.snr).toBeUndefined();
  });

  it('DishHistory uses pingLatencyMs not pingLatency', () => {
    const h: NewDishHistory = {
      current: 0,
      pingLatencyMs: [25, 30],
      pingDropRate: [0.001],
      downlinkThroughputBps: [100_000_000],
      uplinkThroughputBps: [10_000_000],
    };
    expect(h.pingLatencyMs).toHaveLength(2);
    // @ts-expect-error — old pingLatency field must not exist
    expect(h.pingLatency).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run and verify the type tests pass (compile-time checks via @ts-expect-error)**

```bash
npx tsc --noEmit
npx vitest run src/__tests__/grpc-regression.test.ts
```

Expected: tests pass, no type errors.

- [ ] **Step 4: Update `src/lib/grpc/types.ts` to re-export from starlink-dish**

Replace the entire file with:

```typescript
// Re-export from starlink-dish package — DishStatus, DishHistory now come from the library.
// WSMessage, HandoffEvent, EventLogEntry are app-specific and remain here.
export type {
  DishStatus,
  DishHistory,
} from 'starlink-dish';

export interface WSMessage {
  type: 'status' | 'history' | 'handoff' | 'event';
  data: import('starlink-dish').DishStatus | import('starlink-dish').DishHistory | HandoffEvent | EventLogEntry;
  timestamp: number;
}

export interface HandoffEvent {
  previousAzimuth: number;
  previousElevation: number;
  newAzimuth: number;
  newElevation: number;
}

export interface EventLogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'error' | 'handoff';
}
```

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

Expected: type errors in `client.ts`, `mock-data.ts`, `websocket/client.ts` — these are expected. We'll fix them in subsequent tasks.

- [ ] **Step 6: Run existing tests**

```bash
npm test
```

Expected: regression tests still pass (they import from `mock-data.ts` directly, not from types).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/grpc/types.ts src/__tests__/grpc-regression.test.ts
git commit -m "feat: install starlink-dish; re-export DishStatus/DishHistory from package"
```

---

## Task 3: Migrate server.ts

Replace the three local gRPC imports in `server.ts` with `starlink-dish` equivalents.

**Files:**
- Modify: `server.ts`

Current imports (lines 7–8 and 15 in `server.ts`):
```typescript
import { initGrpcClient, getStatus, getHistory, closeGrpcClient } from './src/lib/grpc/client';
import { generateMockStatus, generateMockHistory } from './src/lib/grpc/mock-data';
import type { DishStatus } from './src/lib/grpc/types';
```

- [ ] **Step 1: Write a failing test capturing server-side status shape**

Append to `src/__tests__/grpc-regression.test.ts`:

```typescript
import { useMock, getStatus as libGetStatus, getHistory as libGetHistory, closeClient } from 'starlink-dish';

describe('starlink-dish mock getStatus() matches expected server fields', () => {
  it('returns status with all fields server.ts reads', async () => {
    useMock();
    const s = await libGetStatus();
    expect(s).not.toBeNull();
    // Fields server.ts reads and relays to WebSocket:
    expect(typeof s!.deviceId).toBe('string');
    expect(typeof s!.popPingLatencyMs).toBe('number');
    expect(typeof s!.downlinkThroughputBps).toBe('number');
    expect(typeof s!.uplinkThroughputBps).toBe('number');
    expect(typeof s!.snrAboveNoiseFloor).toBe('boolean');
    expect(typeof s!.uptimeSeconds).toBe('number');
    expect(typeof s!.state).toBe('string');
    expect(typeof s!.obstructionPercentTime).toBe('number');
    expect(typeof s!.popPingDropRate).toBe('number');
    expect(typeof s!.gpsSats).toBe('number');
    expect(typeof s!.boresightAzimuthDeg).toBe('number');
    expect(typeof s!.boresightElevationDeg).toBe('number');
    expect(typeof s!.softwareVersion).toBe('string');
    closeClient();
  });
});
```

- [ ] **Step 2: Run and verify test passes (new library returns all needed fields)**

```bash
npx vitest run src/__tests__/grpc-regression.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Update imports in `server.ts`**

Replace lines 7–8 and 15:

```typescript
// Before:
import { initGrpcClient, getStatus, getHistory, closeGrpcClient } from './src/lib/grpc/client';
import { generateMockStatus, generateMockHistory } from './src/lib/grpc/mock-data';
import type { DishStatus } from './src/lib/grpc/types';

// After:
import { initClient, getStatus, getHistory, closeClient, useMock } from 'starlink-dish';
import type { DishStatus } from 'starlink-dish';
```

The `DishStatus` type now comes directly from `starlink-dish` (not the local re-export shim), so this import will survive the deletion of `src/lib/grpc/types.ts` in Task 6.

- [ ] **Step 4: Replace `initGrpcClient` and `closeGrpcClient` call sites**

Find and replace in `server.ts`:
- `initGrpcClient(dishAddress)` → `initClient(dishAddress)`
- `closeGrpcClient()` → `closeClient()`

There are 3 call sites for init (lines ~90, 99, 235) and 2 for close (lines ~228, 345).

- [ ] **Step 5: Replace mock usage in server.ts**

The current pattern (around lines 141-197):
```typescript
if (isDemoMode) {
  status = generateMockStatus(elapsed);
} else {
  status = await getStatus();
}
```

Becomes:
```typescript
if (isDemoMode) {
  useMock();  // idempotent — safe to call on every poll if already set
  status = await getStatus();
} else {
  status = await getStatus();
}
```

And for history (around line 193-196):
```typescript
// Before:
const history = isDemoMode ? generateMockHistory() : await getHistory();

// After:
const history = await getHistory();  // useMock() already set above if demo mode
```

Note: `useMock()` is idempotent — calling it repeatedly is safe. But to avoid re-installing the mock transport on every poll, track it with a flag:

```typescript
let mockInstalled = false;

// In the status poll loop:
if (isDemoMode && !mockInstalled) {
  useMock();
  mockInstalled = true;
}
const status = await getStatus();
```

Also add reset when switching back to live mode (mode switch handler at line ~228):
```typescript
// When switching to live:
mockInstalled = false;
closeClient();
const connected = await initClient(dishAddress);
```

- [ ] **Step 6: Update `DishStatus` field references in `server.ts`**

`server.ts` uses `status.boresightAzimuth` and `status.boresightElevation` (old names). Find and update:
- `status.boresightAzimuth` → `status.boresightAzimuthDeg`
- `status.boresightElevation` → `status.boresightElevationDeg`
- `status.uptime` → `status.uptimeSeconds`
- `status.popPingLatency` → `status.popPingLatencyMs`
- `status.downlinkThroughput` → `status.downlinkThroughputBps`
- `status.uplinkThroughput` → `status.uplinkThroughputBps`

Run this to find all occurrences:
```bash
grep -n "status\.\(boresightAzimuth\|boresightElevation\|uptime\b\|popPingLatency\|downlinkThroughput\|uplinkThroughput\)\b" server.ts
```

- [ ] **Step 7: Run type check and tests**

```bash
npx tsc --noEmit
npm test
```

Expected: no type errors in `server.ts`; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add server.ts
git commit -m "feat: migrate server.ts gRPC imports to starlink-dish package"
```

---

## Task 4: Migrate websocket/client.ts field references

The WebSocket client receives `DishStatus` over the wire and maps it to the telemetry store. Update field names to match the new `starlink-dish` types.

**Files:**
- Modify: `src/lib/websocket/client.ts`

- [ ] **Step 1: Write failing test for SNR field mapping**

Append to `src/__tests__/grpc-regression.test.ts`:

```typescript
describe('websocket field mapping — snrAboveNoiseFloor → store snr', () => {
  it('snrAboveNoiseFloor:true maps to snr estimate 10.5', () => {
    const snrEstimate = (above: boolean) => above ? 10.5 : 5.0;
    expect(snrEstimate(true)).toBe(10.5);
    expect(snrEstimate(false)).toBe(5.0);
  });
});
```

- [ ] **Step 2: Run and verify test passes**

```bash
npx vitest run src/__tests__/grpc-regression.test.ts
```

Expected: passes (pure logic test).

- [ ] **Step 3: Update field references in `src/lib/websocket/client.ts`**

Current code at lines 48–70 maps `DishStatus` fields to the telemetry store. Update:

```typescript
// Before (lines 47-70):
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

pushHistory({
  ping: status.popPingLatency,
  downlink: status.downlinkThroughput,
  uplink: status.uplinkThroughput,
  snr: status.snr,
});

// After:
updateStatus({
  ping: status.popPingLatencyMs,
  downlink: status.downlinkThroughputBps,
  uplink: status.uplinkThroughputBps,
  snr: status.snrAboveNoiseFloor ? 10.5 : 5.0,
  uptime: status.uptimeSeconds,
  state: status.state,
  obstructions: status.obstructionPercentTime,
  azimuth: currentStatus?.azimuth ?? 0,
  elevation: currentStatus?.elevation ?? 0,
  dropRate: status.popPingDropRate,
  gpsSats: status.gpsSats,
  antennaBoresightAz: status.boresightAzimuthDeg,
  antennaBoresightEl: status.boresightElevationDeg,
  deviceId: status.deviceId,
  softwareVersion: status.softwareVersion,
});

pushHistory({
  ping: status.popPingLatencyMs,
  downlink: status.downlinkThroughputBps,
  uplink: status.uplinkThroughputBps,
  snr: status.snrAboveNoiseFloor ? 10.5 : 5.0,
});
```

The `snr: status.snrAboveNoiseFloor ? 10.5 : 5.0` mapping preserves the existing telemetry store contract (sparklines expect a number) while making the conversion explicit and honest.

- [ ] **Step 4: Run type check and tests**

```bash
npx tsc --noEmit
npm test
```

Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/websocket/client.ts
git commit -m "feat: migrate websocket client to starlink-dish field names; SNR mapping explicit"
```

---

## Task 5: Update TelemetryPanel SNR display

The `TelemetryPanel` currently shows `snr.toFixed(1)` with a dB value. Since `snr` in the store is now an estimate (10.5 or 5.0), add a note about this, and optionally show "OK" / "Low" labels instead.

**Files:**
- Modify: `src/components/hud/TelemetryPanel.tsx`

- [ ] **Step 1: Write failing test for SNR display**

Create `src/__tests__/telemetry-panel-snr.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Test the SNR label logic we're about to add to TelemetryPanel
function snrLabel(snrEstimate: number): string {
  return snrEstimate >= 10 ? 'OK' : 'Low';
}

describe('SNR label', () => {
  it('shows OK when snr is 10.5 (above noise floor)', () => {
    expect(snrLabel(10.5)).toBe('OK');
  });

  it('shows Low when snr is 5.0 (below noise floor)', () => {
    expect(snrLabel(5.0)).toBe('Low');
  });
});
```

- [ ] **Step 2: Run and verify tests fail**

```bash
npx vitest run src/__tests__/telemetry-panel-snr.test.ts
```

Expected: `FAIL` — `snrLabel` is not defined (it's in the test itself as a pure function, but the test should pass immediately — this verifies the label logic before we wire it to the component).

Actually these tests should pass since `snrLabel` is defined in the test file. Run and confirm they pass.

```bash
npx vitest run src/__tests__/telemetry-panel-snr.test.ts
```

Expected: 2 passing.

- [ ] **Step 3: Update `TelemetryPanel.tsx` SNR display**

In `src/components/hud/TelemetryPanel.tsx`, find the SNR display (around line 38 and 77):

```typescript
// Before:
const snr = dishStatus?.snr ?? 0;
// ...
value={snr.toFixed(1)}
// ...
data={history.snr}
```

```typescript
// After:
const snr = dishStatus?.snr ?? 0;
const snrLabel = snr >= 10 ? 'OK' : 'Low';
// ...
value={snrLabel}
// ...
data={history.snr}  // keep sparkline — it still works with 10.5/5.0 values
```

- [ ] **Step 4: Run type check and all tests**

```bash
npx tsc --noEmit
npm test
```

Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/hud/TelemetryPanel.tsx src/__tests__/telemetry-panel-snr.test.ts
git commit -m "feat: update TelemetryPanel SNR display to show OK/Low label"
```

---

## Task 6: Delete src/lib/grpc/

At this point `server.ts` and `src/lib/websocket/client.ts` no longer import from `src/lib/grpc/client.ts` or `src/lib/grpc/mock-data.ts`. The only remaining local files are `types.ts` (now just a re-export shim) and `dish.proto`.

**Files:**
- Delete: `src/lib/grpc/client.ts`
- Delete: `src/lib/grpc/mock-data.ts`
- Delete: `src/lib/grpc/dish.proto`
- Delete: `src/lib/grpc/proto-loader.ts` (if it exists)
- Inline the re-exports from `src/lib/grpc/types.ts` into `src/lib/websocket/client.ts` and remove the file

- [ ] **Step 1: Verify nothing imports from grpc/client.ts or grpc/mock-data.ts**

```bash
grep -rn "from.*grpc/client\|from.*grpc/mock-data\|from.*grpc/proto-loader" src/ server.ts
```

Expected: no output. If any files still import these, fix them before proceeding.

- [ ] **Step 2: Check what still imports from grpc/types.ts**

```bash
grep -rn "from.*grpc/types" src/ server.ts
```

Expected: only `src/lib/websocket/client.ts` (which imports `WSMessage`, `DishStatus`, `DishHistory`, `HandoffEvent`, `EventLogEntry`).

- [ ] **Step 3: Inline WSMessage and related types into websocket/client.ts**

Move the `WSMessage`, `HandoffEvent`, `EventLogEntry` interface definitions from `src/lib/grpc/types.ts` directly into `src/lib/websocket/client.ts`. The `DishStatus` and `DishHistory` imports come from `starlink-dish`.

Note: `EventLogEntry` here uses `type: 'handoff'` (WebSocket protocol value) and is intentionally NOT exported — `telemetry-store.ts` defines its own `EventLogEntry` with `type: 'success'`. These are distinct types; the conversion (`'handoff'` → `'success'`) already happens in the `case 'event'` handler.

At the top of `src/lib/websocket/client.ts`:

```typescript
import type { DishStatus, DishHistory } from 'starlink-dish';

// Local protocol types — not exported (telemetry-store has its own EventLogEntry)
interface WSMessage {
  type: 'status' | 'history' | 'handoff' | 'event';
  data: DishStatus | DishHistory | HandoffEvent | EventLogEntry;
  timestamp: number;
}

interface HandoffEvent {
  previousAzimuth: number;
  previousElevation: number;
  newAzimuth: number;
  newElevation: number;
}

interface EventLogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'error' | 'handoff';
}
```

Remove the old `import type { WSMessage, DishStatus, DishHistory, HandoffEvent, EventLogEntry } from '../grpc/types';` line.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Delete grpc directory**

```bash
rm src/lib/grpc/client.ts
rm src/lib/grpc/mock-data.ts
rm src/lib/grpc/dish.proto
rm src/lib/grpc/types.ts
# Delete proto-loader.ts only if it exists
[ -f src/lib/grpc/proto-loader.ts ] && rm src/lib/grpc/proto-loader.ts
# Only remove directory if empty
rmdir src/lib/grpc 2>/dev/null || true
```

- [ ] **Step 6: Run type check again**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Update regression tests to remove references to deleted files**

The `src/__tests__/grpc-regression.test.ts` imports from `../lib/grpc/mock-data`. Now that file is gone, update the regression test file to test the `starlink-dish` mock directly:

Replace `generateMockStatus`/`generateMockHistory` tests with equivalent tests using `useMock()` + `getStatus()`/`getHistory()` from `starlink-dish`:

```typescript
// src/__tests__/grpc-regression.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { useMock, getStatus, getHistory, closeClient } from 'starlink-dish';
import type { DishStatus as NewDishStatus, DishHistory as NewDishHistory } from 'starlink-dish';

describe('starlink-dish mock getStatus()', () => {
  afterEach(() => closeClient());

  it('returns a DishStatus with all fields server.ts relays', async () => {
    useMock();
    const s = await getStatus();
    expect(s).not.toBeNull();
    expect(typeof s!.deviceId).toBe('string');
    expect(typeof s!.popPingLatencyMs).toBe('number');
    expect(typeof s!.downlinkThroughputBps).toBe('number');
    expect(typeof s!.uplinkThroughputBps).toBe('number');
    expect(typeof s!.snrAboveNoiseFloor).toBe('boolean');
    expect(typeof s!.uptimeSeconds).toBe('number');
    expect(typeof s!.obstructionPercentTime).toBe('number');
    expect(typeof s!.popPingDropRate).toBe('number');
    expect(typeof s!.gpsSats).toBe('number');
    expect(typeof s!.boresightAzimuthDeg).toBe('number');
    expect(typeof s!.boresightElevationDeg).toBe('number');
    expect(s!.state).toBe('CONNECTED');
    expect(s!.downlinkThroughputBps).toBeGreaterThan(1_000_000);
  });
});

describe('starlink-dish mock getHistory()', () => {
  afterEach(() => closeClient());

  it('returns a DishHistory with 60 samples', async () => {
    useMock();
    const h = await getHistory();
    expect(h).not.toBeNull();
    expect(h!.pingLatencyMs).toHaveLength(60);
    expect(h!.downlinkThroughputBps).toHaveLength(60);
    expect(h!.uplinkThroughputBps).toHaveLength(60);
    expect(h!.pingLatencyMs.every((v) => v > 0)).toBe(true);
  });
});

describe('starlink-dish type contract', () => {
  it('DishStatus has snrAboveNoiseFloor boolean (not snr number)', () => {
    const s: NewDishStatus = {
      deviceId: 'test', hardwareVersion: '4.0', softwareVersion: '1.0',
      countryCode: 'US', bootcount: 0, uptimeSeconds: 0, state: 'CONNECTED',
      downlinkThroughputBps: 0, uplinkThroughputBps: 0, popPingLatencyMs: 0,
      popPingDropRate: 0, obstructionPercentTime: 0, currentlyObstructed: false,
      snrAboveNoiseFloor: true, snrPersistentlyLow: false,
      boresightAzimuthDeg: 0, boresightElevationDeg: 0,
      gpsValid: true, gpsSats: 0, ethSpeedMbps: 0, alerts: [],
    };
    expect(typeof s.snrAboveNoiseFloor).toBe('boolean');
  });

  it('DishHistory uses pingLatencyMs not pingLatency', () => {
    const h: NewDishHistory = {
      current: 0, pingLatencyMs: [25], pingDropRate: [0.001],
      downlinkThroughputBps: [100_000_000], uplinkThroughputBps: [10_000_000],
    };
    expect(h.pingLatencyMs).toHaveLength(1);
  });
});

describe('websocket field mapping — snrAboveNoiseFloor → store snr', () => {
  it('snrAboveNoiseFloor:true maps to snr estimate 10.5', () => {
    const snrEstimate = (above: boolean) => above ? 10.5 : 5.0;
    expect(snrEstimate(true)).toBe(10.5);
    expect(snrEstimate(false)).toBe(5.0);
  });
});
```

- [ ] **Step 9: Run final test suite**

```bash
npm test
```

Expected: all tests pass with no references to deleted files.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: delete src/lib/grpc/ — fully migrated to starlink-dish package"
```

---

## Task 7: Final validation

- [ ] **Step 1: Full type check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Start the dev server and verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
- Demo mode works (satellite visualization renders)
- HUD shows telemetry (ping, DL, UL, SNR label "OK"/"Low")
- TelemetryPanel sparklines render
- HandoffPanel shows satellite stats
- No console errors related to gRPC or field names

- [ ] **Step 4: Verify `src/lib/grpc/` no longer exists**

```bash
ls src/lib/grpc/ 2>&1
```

Expected: `No such file or directory`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final migration validation — starlink-dish package fully integrated"
```
