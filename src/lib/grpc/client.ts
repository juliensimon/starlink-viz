import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import type { DishStatus, DishHistory } from './types';

let client: grpc.Client | null = null;
let handleMethod: ((request: unknown, callback: (err: grpc.ServiceError | null, response: unknown) => void) => void) | null = null;

const PROTO_PATH = path.join(process.cwd(), 'src/lib/grpc/dish.proto');

export async function initGrpcClient(address: string): Promise<boolean> {
  try {
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: false,
      longs: Number,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition);

    // Navigate to SpaceX.API.Device.Device service
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DeviceService = (proto as any).SpaceX?.API?.Device?.Device;
    if (!DeviceService) {
      console.error('Failed to find Device service in proto definition');
      return false;
    }

    client = new DeviceService(
      address,
      grpc.credentials.createInsecure(),
      {
        'grpc.keepalive_time_ms': 10000,
        'grpc.keepalive_timeout_ms': 5000,
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleMethod = (client as any).handle.bind(client);

    // Test connectivity with a deadline
    return new Promise((resolve) => {
      const deadline = new Date(Date.now() + 3000);
      client!.waitForReady(deadline, (err) => {
        if (err) {
          console.error('gRPC connection failed:', err.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  } catch (err) {
    console.error('Failed to initialize gRPC client:', err);
    return false;
  }
}

export async function getStatus(): Promise<DishStatus | null> {
  if (!handleMethod) return null;

  return new Promise((resolve) => {
    const request = { getStatus: {} };
    handleMethod!(request, (err, response) => {
      if (err) {
        console.error('gRPC getStatus error:', err.message);
        resolve(null);
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = response as any;
        const status = r.dishGetStatus;
        if (!status) {
          resolve(null);
          return;
        }

        const alerts: string[] = [];
        if (status.alerts) {
          if (status.alerts.motorsStuck) alerts.push('motors_stuck');
          if (status.alerts.thermalThrottle) alerts.push('thermal_throttle');
          if (status.alerts.thermalShutdown) alerts.push('thermal_shutdown');
          if (status.alerts.unexpectedLocation) alerts.push('unexpected_location');
          if (status.alerts.slowEthernetSpeeds) alerts.push('slow_ethernet_speeds');
        }

        const obstructionPct = status.obstructionStats
          ? (status.obstructionStats.fractionObstructed || 0) * 100
          : 0;

        // SNR is no longer directly reported; use isSnrAboveNoiseFloor as a proxy
        const snrEstimate = status.isSnrAboveNoiseFloor ? 10.5 : 5.0;

        resolve({
          deviceId: status.deviceInfo?.id || 'unknown',
          hardwareVersion: status.deviceInfo?.hardwareVersion || 'unknown',
          softwareVersion: status.deviceInfo?.softwareVersion || 'unknown',
          state: status.deviceState ? 'CONNECTED' : 'UNKNOWN',
          uptime: Number(status.deviceState?.uptimeS || 0),
          snr: snrEstimate,
          downlinkThroughput: status.downlinkThroughputBps || 0,
          uplinkThroughput: status.uplinkThroughputBps || 0,
          popPingLatency: status.popPingLatencyMs || 0,
          popPingDropRate: status.popPingDropRate || 0,
          obstructionPercentTime: obstructionPct,
          boresightAzimuth: status.boresightAzimuthDeg || 0,
          boresightElevation: status.boresightElevationDeg || 0,
          gpsSats: status.gpsStats?.gpsSats || 0,
          alerts,
        });
      } catch (parseErr) {
        console.error('Failed to parse gRPC status response:', parseErr);
        resolve(null);
      }
    });
  });
}

export async function getHistory(): Promise<DishHistory | null> {
  if (!handleMethod) return null;

  return new Promise((resolve) => {
    const request = { getHistory: {} };
    handleMethod!(request, (err, response) => {
      if (err) {
        console.error('gRPC getHistory error:', err.message);
        resolve(null);
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = response as any;
        const history = r.dishGetHistory;
        if (!history) {
          resolve(null);
          return;
        }

        const pingArr = history.popPingLatencyMs || [];
        // SNR history not available from dish; fill with constant estimate
        const snrArr = pingArr.map(() => 10.5);

        resolve({
          pingLatency: pingArr,
          downlinkThroughput: history.downlinkThroughputBps || [],
          uplinkThroughput: history.uplinkThroughputBps || [],
          snr: snrArr,
        });
      } catch (parseErr) {
        console.error('Failed to parse gRPC history response:', parseErr);
        resolve(null);
      }
    });
  });
}

export function closeGrpcClient(): void {
  if (client) {
    client.close();
    client = null;
    handleMethod = null;
  }
}
