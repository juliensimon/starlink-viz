/**
 * Traceroute analyzer for Starlink network path inspection.
 * Extracts PoP, satellite hop latency, and peering information from traceroute output.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface TracerouteHop {
  hop: number;
  ip: string;
  hostname: string;
  latencyMs: number;
  label: string;
}

export interface TracerouteResult {
  destination: string;
  hops: TracerouteHop[];
  satelliteLinkMs: number | null;   // Hop 2 RTT (dish → sat → GS)
  backboneMs: number | null;        // Hops 3-5 within SpaceX network
  peeringPopMs: number | null;      // Hop 6 — exit to internet
  totalMs: number | null;           // Final hop RTT
  pop: string | null;               // Detected PoP from hostnames
  timestamp: number;
}

const STARLINK_RANGES = ['206.224.', '149.19.', '100.64.'];

function isStarlinkIp(ip: string): boolean {
  return STARLINK_RANGES.some((r) => ip.startsWith(r));
}

function parsePopFromHostname(hostname: string): string | null {
  // customer.lax3.mc.starlinkisp.net → lax3
  // customer.frntdeu1.isp.starlink.com → frntdeu1
  const match = hostname.match(/customer\.([a-z]+\d+)\./i);
  return match ? match[1] : null;
}

function classifyHop(hop: number, ip: string, hostname: string): string {
  if (ip === '192.168.1.1') return 'Router';
  if (ip === '100.64.0.1') return 'CGNAT (Satellite link)';
  if (ip.startsWith('172.16.')) return 'Ground station';
  if (hostname.includes('starlinkisp') || hostname.includes('starlink.com')) return 'PoP exit';
  if (isStarlinkIp(ip)) return 'SpaceX backbone';
  return 'Internet';
}

export async function runTraceroute(destination: string): Promise<TracerouteResult> {
  const result: TracerouteResult = {
    destination,
    hops: [],
    satelliteLinkMs: null,
    backboneMs: null,
    peeringPopMs: null,
    totalMs: null,
    pop: null,
    timestamp: Date.now(),
  };

  try {
    const { stdout } = await execFileAsync(
      'traceroute',
      ['-m', '12', '-w', '2', '-q', '1', destination],
      { timeout: 20000 }
    );

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      // Parse: " 2  100.64.0.1 (100.64.0.1)  19.816 ms"
      const match = line.match(
        /^\s*(\d+)\s+(?:(\S+)\s+)?\(?([\d.]+)\)?\s+(?:[\d.]+ ms\s+)*?([\d.]+) ms/
      );
      if (!match) continue;

      const hop = parseInt(match[1]);
      const hostname = match[2] || match[3];
      const ip = match[3];
      const latencyMs = parseFloat(match[4]);

      const label = classifyHop(hop, ip, hostname);

      result.hops.push({ hop, ip, hostname, latencyMs, label });

      // Extract specific metrics
      if (ip === '100.64.0.1') {
        result.satelliteLinkMs = latencyMs;
      }
      if (ip.startsWith('172.16.')) {
        result.backboneMs = latencyMs;
      }
      if (hostname.includes('starlinkisp') || hostname.includes('starlink.com')) {
        result.peeringPopMs = latencyMs;
        result.pop = parsePopFromHostname(hostname);
      }
    }

    // Total = last hop
    if (result.hops.length > 0) {
      result.totalMs = result.hops[result.hops.length - 1].latencyMs;
    }
  } catch {
    // Traceroute failed — return empty result
  }

  return result;
}
