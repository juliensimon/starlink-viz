/**
 * Display formatting utilities.
 */

/** Format bytes per second to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} Gbps`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} Mbps`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} Kbps`;
  return `${bytes.toFixed(0)} bps`;
}

/** Format milliseconds */
export function formatMs(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

/** Format degrees */
export function formatDegrees(deg: number): string {
  return `${deg.toFixed(1)}\u00B0`;
}

/** Format uptime in seconds to human-readable duration */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
}
