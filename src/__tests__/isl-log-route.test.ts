/**
 * Tests for /api/isl-log.
 *
 * Bug history: POST appended arbitrary unvalidated JSON with no size cap,
 * GET read the whole ever-growing file synchronously per request, and the
 * log grew without bound.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dir = mkdtempSync(join(tmpdir(), 'isl-log-test-'));
const logPath = join(dir, 'isl-route.log');
process.env.ISL_LOG_PATH = logPath;

// Import AFTER setting the env override so the route writes to the temp file.
const routes = await import('../app/api/isl-log/route');

function validEntry(overrides: Record<string, unknown> = {}) {
  return {
    time: new Date().toISOString(),
    action: 'new',
    reason: 'initial route',
    route: { type: 'direct', hops: 0, gs: 'Test, XX', latencyMs: 32.1 },
    context: {},
    ...overrides,
  };
}

function post(body: unknown): Promise<Response> {
  return routes.POST(
    new Request('http://localhost/api/isl-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  rmSync(logPath, { force: true });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('POST /api/isl-log', () => {
  it('appends a valid route decision entry', async () => {
    const res = await post(validEntry());
    expect(res.status).toBe(200);
    const content = readFileSync(logPath, 'utf-8').trim();
    expect(JSON.parse(content).action).toBe('new');
  });

  it('rejects entries that are not route decisions', async () => {
    const res = await post({ whatever: 'x'.repeat(50) });
    expect(res.status).toBe(400);
    expect(existsSync(logPath)).toBe(false);
  });

  it('rejects non-object bodies', async () => {
    const res = await post('just a string');
    expect(res.status).toBe(400);
  });

  it('rejects oversized entries', async () => {
    const res = await post(validEntry({ reason: 'x'.repeat(20_000) }));
    expect(res.status).toBe(413);
    expect(existsSync(logPath)).toBe(false);
  });

  it('rotates the log when it grows beyond the size cap', async () => {
    // Pre-fill the log beyond the cap, then append once more.
    const bigLine = JSON.stringify(validEntry({ reason: 'filler' })) + '\n';
    const lines = Math.ceil((5 * 1024 * 1024) / bigLine.length) + 10;
    writeFileSync(logPath, bigLine.repeat(lines));

    const res = await post(validEntry({ reason: 'after rotation' }));
    expect(res.status).toBe(200);

    const content = readFileSync(logPath, 'utf-8');
    expect(content.length).toBeLessThan(5 * 1024 * 1024);
    expect(content).toContain('after rotation');
  });
});

describe('GET /api/isl-log', () => {
  it('returns the last entries', async () => {
    for (let i = 0; i < 3; i++) {
      await post(validEntry({ reason: `entry ${i}` }));
    }
    const res = await routes.GET();
    const entries = await res.json();
    expect(entries.length).toBe(3);
    expect(entries[2].reason).toBe('entry 2');
  });

  it('returns [] when no log exists', async () => {
    const res = await routes.GET();
    expect(await res.json()).toEqual([]);
  });
});
