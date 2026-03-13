'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import MiniChart from './MiniChart';

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  data: number[];
  color?: string;
}

function MetricCard({ label, value, unit, data, color = '#00ffff' }: MetricCardProps) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg tabular-nums hud-glow-text-strong">{value}</span>
        <span className="text-[10px] text-white/40">{unit}</span>
      </div>
      <MiniChart data={data} width={140} height={32} color={color} fillColor={color} />
    </div>
  );
}

function bytesToMbps(bytesPerSec: number): number {
  return (bytesPerSec * 8) / 1_000_000;
}

export default function TelemetryPanel() {
  const history = useTelemetryStore((s) => s.history);
  const dishStatus = useTelemetryStore((s) => s.dishStatus);

  const ping = dishStatus?.ping ?? 0;
  const downlink = dishStatus?.downlink ?? 0;
  const uplink = dishStatus?.uplink ?? 0;
  const snr = dishStatus?.snr ?? 0;

  const dlMbps = bytesToMbps(downlink);
  const ulMbps = bytesToMbps(uplink);

  // Convert history from bytes/s to Mbps for display
  const dlHistory = history.downlink.map(bytesToMbps);
  const ulHistory = history.uplink.map(bytesToMbps);

  return (
    <div className="hud-panel p-3 w-[320px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-3">
        Telemetry
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <MetricCard
          label="Ping"
          value={ping.toFixed(0)}
          unit="ms"
          data={history.ping}
          color="#00ffff"
        />
        <MetricCard
          label="Download"
          value={dlMbps.toFixed(1)}
          unit="Mbps"
          data={dlHistory}
          color="#22d3ee"
        />
        <MetricCard
          label="Upload"
          value={ulMbps.toFixed(1)}
          unit="Mbps"
          data={ulHistory}
          color="#06b6d4"
        />
        <MetricCard
          label="SNR"
          value={snr.toFixed(1)}
          unit="dB"
          data={history.snr}
          color="#67e8f9"
        />
      </div>
    </div>
  );
}
