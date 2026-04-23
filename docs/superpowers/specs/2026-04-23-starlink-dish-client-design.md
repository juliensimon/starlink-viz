# starlink-dish: Standalone TypeScript Client Library + CLI

**Date:** 2026-04-23
**Status:** Approved

## Overview

Extract the Starlink dish gRPC client from this visualization app into a standalone npm package with a CLI. Fills a real gap: no TypeScript/Node.js Starlink client exists in the open-source ecosystem (sparky8512/starlink-grpc-tools is Python-only with 514 stars).

## Scope

- Library: `getStatus()`, `getHistory()`, `reboot()`, `speedTest()`
- CLI: `starlink-dish status|history|reboot|speed-test`
- Mock/demo mode for development without a physical dish
- Published to npm + separate GitHub repo

Out of scope: dish control (stow/unstow), account API, satellite propagation, visualization.

## Repository Structure

New repo: `github.com/juliensimon/starlink-dish`

```
starlink-dish/
├── src/
│   ├── client.ts        # gRPC connection: initClient(), closeClient(), isConnected()
│   ├── status.ts        # getStatus()
│   ├── history.ts       # getHistory()
│   ├── control.ts       # reboot(), speedTest()
│   ├── mock.ts          # mock data generators, useMock()
│   ├── types.ts         # DishStatus, DishHistory, SpeedTestResult, MockOptions
│   └── index.ts         # re-exports public API
├── proto/
│   └── dish.proto       # extended with reboot + speed test messages
├── cli/
│   └── index.ts         # CLI entry point
├── tests/
│   ├── status.test.ts
│   ├── history.test.ts
│   ├── control.test.ts
│   └── mock.test.ts
├── package.json         # name: "starlink-dish", bin: { "starlink-dish": "..." }
├── tsconfig.json
└── .github/workflows/
    ├── ci.yml           # tsc + vitest on PR
    └── publish.yml      # npm publish on release tag
```

## Library API

```typescript
// Connection
initClient(address?: string): Promise<boolean>  // default: 192.168.100.1:9200
closeClient(): void
isConnected(): boolean

// Telemetry
getStatus(): Promise<DishStatus | null>
getHistory(): Promise<DishHistory | null>

// Control
reboot(): Promise<boolean>
speedTest(): Promise<SpeedTestResult | null>

// Mock mode
useMock(options?: MockOptions): void  // call before initClient()
```

### Key Types

```typescript
interface DishStatus {
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
  snrAboveNoiseFloor: boolean;      // raw boolean — replaces the fake dB estimate in current code
  snrPersistentlyLow: boolean;
  boresightAzimuthDeg: number;
  boresightElevationDeg: number;
  gpsValid: boolean;
  gpsSats: number;
  ethSpeedMbps: number;
  alerts: string[];
}

interface DishHistory {
  current: number;
  pingLatencyMs: number[];
  pingDropRate: number[];
  downlinkThroughputBps: number[];
  uplinkThroughputBps: number[];
}

interface SpeedTestResult {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
}

interface MockOptions {
  seed?: number;
  simulateLatency?: boolean;
  faultRate?: number;           // 0-1, probability of returning null
}
```

### Proto Extensions

Two new message pairs added to `dish.proto`:
- `RebootRequest` / `RebootResponse` (field numbers from sparky8512 wiki)
- `SpeedTestRequest` / `SpeedTestResponse`

The `Request.request` oneof and `Response.response` oneof are extended accordingly.

## CLI

```bash
# Install globally
npm install -g starlink-dish

# Commands
starlink-dish status                            # pretty-printed status
starlink-dish status --json                     # raw JSON (pipeable)
starlink-dish history                           # last N samples as table
starlink-dish history --json
starlink-dish reboot                            # prompts for confirmation
starlink-dish speed-test                        # prints Mbps results
starlink-dish --address 10.0.0.1:9200 status   # custom dish address
starlink-dish --mock status                     # mock mode, no dish needed
```

Pretty-printed `status` example:
```
Starlink Dish  •  hw: 4.0  sw: 2025.12.0  up: 3d 4h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Download    87.3 Mbps   Upload    14.2 Mbps
 Ping        28.4 ms     Drop      0.02%
 SNR         above noise floor
 Obstruction 0.3%        GPS sats  9
 Boresight   Az 192°  El 47°
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Alerts: none
```

## Migration in This App

Once published to npm:

1. `npm install starlink-dish`
2. Write regression tests against current `src/lib/grpc/client.ts` behavior (mock-based) — these become the safety net
3. Swap imports one file at a time, running `npm test` after each:
   - `server.ts`: `initGrpcClient` → `initClient` (function names change, signatures identical)
   - `src/lib/grpc/mock-data.ts` → replaced by `useMock()` from package
   - `telemetry-store.ts` + `TelemetryPanel`: `DishHistory` field renames — `pingLatency` → `pingLatencyMs`, `downlinkThroughput` → `downlinkThroughputBps`, `uplinkThroughput` → `uplinkThroughputBps`; `snr` field dropped entirely (failing test first)
   - HUD components: `DishStatus.snr` number → `snrAboveNoiseFloor` boolean (failing test written first)
4. Delete `src/lib/grpc/` entirely once all tests pass

## TDD Strategy

### In `starlink-dish` repo

- Every exported function has tests before implementation
- Two layers: unit tests (mock gRPC transport) + mock mode integration tests (full stack, no network)
- Proto message shapes defined in test expectations first, then proto file written to match
- No production code without a failing test first

### In this app (migration)

- Write tests for current `client.ts` behavior before touching imports
- Migrate one file at a time — `npm test` must pass after each swap
- SNR boolean change: failing test first (HUD receives `snrAboveNoiseFloor: true` → renders correctly)
- `npm run test` green before, during, and after every step

## Open-Source Context

Existing projects this fills a gap alongside:
- [sparky8512/starlink-grpc-tools](https://github.com/sparky8512/starlink-grpc-tools) — Python, 514 stars, the canonical reference for proto field numbers
- [ewilken/starlink-rs](https://github.com/ewilken/starlink-rs) — Rust
- [clarkzjw/starlink-grpc-golang](https://github.com/clarkzjw/starlink-grpc-golang) — Go

No TypeScript/Node.js client exists. This package targets JS/TS developers building monitoring dashboards, Home Assistant integrations, and ISP tooling.
