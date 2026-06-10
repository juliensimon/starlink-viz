import { NextResponse } from 'next/server';
import { appendFile, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

function logPath(): string {
  return process.env.ISL_LOG_PATH ?? join(process.cwd(), 'isl-route.log');
}

/** One serialized entry must stay small — reject anything pathological. */
const MAX_ENTRY_BYTES = 8 * 1024;
/** Rotate once the log file exceeds this size, keeping the newest lines. */
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const ROTATE_KEEP_LINES = 1000;

const VALID_ACTIONS = new Set(['hold', 'hold-invalid', 'new', 'fallback']);

/** Light shape check against RouteDecisionEntry (isl-pathfinder.ts). */
function isRouteDecisionEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.time === 'string' &&
    typeof e.action === 'string' &&
    VALID_ACTIONS.has(e.action) &&
    typeof e.reason === 'string'
  );
}

export async function POST(request: Request) {
  let entry: unknown;
  try {
    entry = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  if (!isRouteDecisionEntry(entry)) {
    return NextResponse.json({ ok: false, error: 'not a route decision entry' }, { status: 400 });
  }

  const line = JSON.stringify(entry) + '\n';
  if (line.length > MAX_ENTRY_BYTES) {
    return NextResponse.json({ ok: false, error: 'entry too large' }, { status: 413 });
  }

  try {
    await rotateIfNeeded();
    await appendFile(logPath(), line);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function rotateIfNeeded(): Promise<void> {
  let content: string;
  try {
    content = await readFile(logPath(), 'utf-8');
  } catch {
    return; // no log yet
  }
  if (content.length <= MAX_LOG_BYTES) return;
  const lines = content.trim().split('\n');
  const kept = lines.slice(-ROTATE_KEEP_LINES).join('\n') + '\n';
  await writeFile(logPath(), kept);
}

export async function GET() {
  try {
    const content = await readFile(logPath(), 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines.slice(-100).map((l: string) => JSON.parse(l));
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([]);
  }
}
