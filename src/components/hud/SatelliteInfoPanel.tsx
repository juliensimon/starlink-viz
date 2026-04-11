'use client';

import { useState, useEffect } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { useAppStore } from '@/stores/app-store';
import { formatDegrees } from '@/lib/utils/formatting';
import { getSatelliteName, getNoradId, getConnectedOrbitalData, getConnectedGroundStation, getCurrentRoute, setDetectedPop } from '@/lib/satellites/satellite-store';
import { GROUND_STATIONS } from '@/lib/satellites/ground-stations';

function latencyConfidence(
  measuredPing: number | undefined,
  geometricLatency: number | null,
  demoMode: boolean,
): { color: string; label: string; delta: number } | null {
  if (demoMode || !measuredPing || !geometricLatency) return null;
  const delta = Math.abs(measuredPing - geometricLatency);
  if (delta < 10) return { color: 'bg-green-400', label: 'High', delta };
  if (delta < 25) return { color: 'bg-yellow-400', label: 'Medium', delta };
  return { color: 'bg-red-400', label: 'Low', delta };
}

export default function SatelliteInfoPanel() {
  const status = useTelemetryStore((s) => s.dishStatus);
  const geometricLatency = useTelemetryStore((s) => s.geometricLatency);
  const connectedSatelliteIndex = useAppStore((s) => s.connectedSatelliteIndex);
  const demoMode = useAppStore((s) => s.demoMode);

  const azimuth = status?.azimuth ?? 0;
  const elevation = status?.elevation ?? 0;
  const hasConnection = connectedSatelliteIndex !== null;

  const islPrediction = useAppStore((s) => s.islPrediction);
  const demoLocation = useAppStore((s) => s.demoLocation);

  // Poll orbital data, gateway, and route from satellite store
  const [altitude, setAltitude] = useState<number | null>(null);
  const [velocity, setVelocity] = useState<number | null>(null);
  const [gateway, setGateway] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const [routeType, setRouteType] = useState<'direct' | 'isl' | null>(null);
  const [hopCount, setHopCount] = useState(0);
  const [routingGS, setRoutingGS] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const data = getConnectedOrbitalData();
      if (data) {
        setAltitude(data.altitudeKm);
        setVelocity(data.velocityKmS);
      } else {
        setAltitude(null);
        setVelocity(null);
      }
      setGateway(getConnectedGroundStation());

      // Poll current route
      const route = getCurrentRoute();
      if (route) {
        setRouteType(route.type);
        setHopCount(route.hopCount);
        const gs = GROUND_STATIONS[route.groundStationIndex];
        setRoutingGS(gs?.name ?? null);
      } else {
        setRouteType(null);
        setHopCount(0);
        setRoutingGS(null);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Fetch PoP on mount, retry if unknown
  useEffect(() => {
    let retries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const fetchPop = () => {
      fetch('/api/pop')
        .then((r) => r.json())
        .then((d) => {
          if (d.pop) {
            setPop(d.pop);
            if (d.pop !== 'Unknown') setDetectedPop(d.pop);
          }
          if (d.pop === 'Unknown' && retries < 3) {
            retries++;
            timer = setTimeout(fetchPop, 10000);
          }
        })
        .catch(() => {
          if (retries < 3) {
            retries++;
            timer = setTimeout(fetchPop, 10000);
          }
        });
    };
    fetchPop();
    return () => clearTimeout(timer);
  }, []);

  const satName = hasConnection ? getSatelliteName(connectedSatelliteIndex) : null;
  const noradId = hasConnection ? getNoradId(connectedSatelliteIndex) : null;

  return (
    <div className="hud-panel p-4 w-full md:w-[280px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-2">
        Satellite Link
      </div>

      {/* Satellite identity */}
      <div className="flex items-center gap-2 mb-1">
        {hasConnection ? (
          <span className="text-sm hud-glow-text truncate">
            {satName}
          </span>
        ) : (
          <span className="text-sm text-yellow-400 animate-pulse">Scanning...</span>
        )}
      </div>
      {noradId && (
        <div className="text-[10px] text-white/40 mb-2 tabular-nums">
          NORAD {noradId}
        </div>
      )}

      {/* Boresight readings */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-1">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-white/50">Az</span>
          <span className="text-sm tabular-nums hud-glow-text">{formatDegrees(azimuth)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-white/50">El</span>
          <span className="text-sm tabular-nums hud-glow-text">{formatDegrees(elevation)}</span>
        </div>
      </div>

      <hr className="hud-divider my-2" />

      {/* Orbital info */}
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] text-white/50">Altitude</span>
        <span className="text-xs tabular-nums text-white/70">
          {altitude !== null ? `${altitude.toFixed(1)} km` : '---'}
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] text-white/50">Velocity</span>
        <span className="text-xs tabular-nums text-white/70">
          {velocity !== null ? `${velocity.toFixed(2)} km/s` : '---'}
        </span>
      </div>

      {/* Latency cross-validation confidence (live mode only) */}
      {(() => {
        const conf = latencyConfidence(status?.ping, geometricLatency, demoMode);
        if (!conf) return null;
        return (
          <>
            <hr className="hud-divider my-2" />
            <div
              className="flex justify-between items-center"
              title={`Measured ping ${status?.ping?.toFixed(0)}ms vs geometric ${geometricLatency?.toFixed(0)}ms (Δ${conf.delta.toFixed(0)}ms). Low confidence may indicate ISL routing or incorrect satellite guess.`}
            >
              <span className="text-[11px] text-white/50">Confidence</span>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${conf.color}`} />
                <span className="text-[10px] text-white/50 tabular-nums">{conf.label} (Δ{conf.delta.toFixed(0)}ms)</span>
              </div>
            </div>
          </>
        );
      })()}

      {/* ISL route info */}
      {islPrediction && hasConnection && (
        <>
          <hr className="hud-divider my-2" />
          <div className="flex justify-between items-center mb-1" title={
            !routeType ? 'No ISL path found — satellite cannot reach any gateway within LoS'
            : routeType === 'isl' ? `Traffic routes through ${hopCount} inter-satellite laser hops`
            : 'Direct bent-pipe route to nearest ground station'
          }>
            <span className="text-[11px] text-white/50">Route</span>
            <div className="flex items-center gap-1.5">
              {routeType ? (
                <>
                  <span className={`inline-block w-2 h-2 rounded-full ${routeType === 'isl' ? 'bg-green-400' : 'bg-cyan-400'}`} />
                  <span className="text-[10px] text-white/50 tabular-nums">
                    {routeType === 'isl' ? `ISL (${hopCount} hop${hopCount !== 1 ? 's' : ''})` : 'Direct'}
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-red-400/70 tabular-nums">No path</span>
              )}
            </div>
          </div>
          {routeType === 'isl' && routingGS && routingGS !== gateway && (
            <div className="flex justify-between items-baseline mb-1" title="Ground station traffic routes through via ISL hops (may differ from nearest)">
              <span className="text-[11px] text-white/50">Routing GS</span>
              <span className="text-[10px] tabular-nums" style={{ color: '#44ff88' }}>{routingGS}</span>
            </div>
          )}
        </>
      )}

      {/* Gateway and PoP */}
      {(gateway || pop) && <hr className="hud-divider my-2" />}
      {gateway && (
        <div className="flex justify-between items-baseline mb-1" title="Starlink ground station relaying your traffic">
          <span className="text-[11px] text-white/50">Gateway</span>
          <span className="text-[10px] tabular-nums" style={{ color: '#ff9933' }}>{gateway}</span>
        </div>
      )}
      {(pop || demoLocation) && (
        <div className="flex justify-between items-baseline" title="Point of Presence — internet exchange where your traffic exits Starlink">
          <span className="text-[11px] text-white/50">PoP</span>
          <span className="text-[10px] tabular-nums" style={{ color: '#ff9933' }}>{demoLocation?.pop ?? pop}</span>
        </div>
      )}
    </div>
  );
}
