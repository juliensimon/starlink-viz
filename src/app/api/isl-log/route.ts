import { NextResponse } from 'next/server';
import { appendFileSync } from 'fs';
import { join } from 'path';

const LOG_PATH = join(process.cwd(), 'isl-route.log');

export async function POST(request: Request) {
  try {
    const entry = await request.json();
    const line = JSON.stringify(entry) + '\n';
    appendFileSync(LOG_PATH, line);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { readFileSync } = require('fs');
    const content = readFileSync(LOG_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines.slice(-100).map((l: string) => JSON.parse(l));
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([]);
  }
}
