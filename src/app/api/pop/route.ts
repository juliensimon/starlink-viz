import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { parsePopHostname } from '@/lib/utils/pop';

// Cache successful results — PoP rarely changes during a session
let cached: { ip: string; rdns: string; pop: string; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const IP_SERVICES = [
  ['curl', ['-s', '--max-time', '2', 'https://api.ipify.org']],
  ['curl', ['-s', '--max-time', '2', 'https://ifconfig.me']],
  ['curl', ['-s', '--max-time', '2', 'https://icanhazip.com']],
  ['curl', ['-s', '--max-time', '2', 'https://checkip.amazonaws.com']],
] as const;

function getPublicIp(): string | null {
  for (const [cmd, args] of IP_SERVICES) {
    try {
      const ip = execFileSync(cmd, [...args], { timeout: 4000 }).toString().trim();
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
    } catch {
      // try next service
    }
  }
  return null;
}

export async function GET() {
  // Return cache if fresh
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ip: cached.ip, rdns: cached.rdns, pop: cached.pop });
  }

  try {
    const ip = getPublicIp();
    if (!ip) {
      return NextResponse.json({ ip: null, rdns: null, pop: 'Unknown' });
    }

    const rdns = execFileSync('dig', ['-x', ip, '+short'], { timeout: 5000 }).toString().trim();
    const pop = parsePopHostname(rdns) || 'Unknown';

    if (pop !== 'Unknown') {
      cached = { ip, rdns, pop, ts: Date.now() };
    }

    return NextResponse.json({ ip, rdns, pop });
  } catch {
    return NextResponse.json({ ip: null, rdns: null, pop: 'Unknown' });
  }
}
