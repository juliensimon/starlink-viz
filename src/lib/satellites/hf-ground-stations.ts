/**
 * Fetches Starlink ground station data from the HF dataset
 * juliensimon/starlink-ground-stations (gateways + pops configs).
 *
 * Gateways: up to 300 rows, paginated at 100/request
 * PoPs: ~14 rows, single request
 */

import type { GroundStation } from './ground-stations';

const HF_DATASET = 'juliensimon/starlink-ground-stations';
const HF_BASE_URL = 'https://datasets-server.huggingface.co/rows';
const FETCH_TIMEOUT_MS = 10_000;

interface HFRowsResponse {
  rows: Array<{ row: Record<string, unknown> }>;
  num_rows_total: number;
}

export interface HFPop {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

async function fetchPage(config: string, offset: number, length: number): Promise<HFRowsResponse> {
  const url = `${HF_BASE_URL}?dataset=${encodeURIComponent(HF_DATASET)}&config=${config}&split=train&offset=${offset}&length=${length}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HF API ${res.status}: ${res.statusText}`);
    return await res.json() as HFRowsResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch all gateway rows from the HF dataset (paginated).
 * Maps each row to the GroundStation interface.
 */
export async function fetchHFGateways(): Promise<GroundStation[]> {
  const stations: GroundStation[] = [];
  const pageSize = 100;

  // First page — also tells us total row count
  const first = await fetchPage('gateways', 0, pageSize);
  for (const { row } of first.rows) {
    stations.push(mapRowToStation(row));
  }

  // Remaining pages
  const total = first.num_rows_total;
  for (let offset = pageSize; offset < total; offset += pageSize) {
    const page = await fetchPage('gateways', offset, pageSize);
    for (const { row } of page.rows) {
      stations.push(mapRowToStation(row));
    }
  }

  return stations;
}

function mapRowToStation(row: Record<string, unknown>): GroundStation {
  return {
    name: String(row.name ?? ''),
    lat: Number(row.lat),
    lon: Number(row.lon),
    status: (row.status as GroundStation['status']) ?? 'operational',
  };
}

/**
 * Fetch all PoP rows from the HF dataset (single page, ~14 rows).
 */
export async function fetchHFPops(): Promise<HFPop[]> {
  const page = await fetchPage('pops', 0, 100);
  return page.rows.map(({ row }) => ({
    code: String(row.code ?? ''),
    city: String(row.city ?? ''),
    country: String(row.country ?? ''),
    lat: Number(row.lat),
    lon: Number(row.lon),
  }));
}
