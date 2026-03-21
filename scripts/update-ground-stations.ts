/**
 * Fetches the latest Starlink ground station locations from the HF dataset
 * juliensimon/starlink-ground-stations and updates data/ground-stations.json.
 *
 * Usage: npx tsx scripts/update-ground-stations.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const DATA_PATH = join(import.meta.dirname, '..', 'data/ground-stations.json');
const HF_DATASET = 'juliensimon/starlink-ground-stations';
const HF_BASE_URL = 'https://datasets-server.huggingface.co/rows';

interface Station {
  name: string;
  lat: number;
  lon: number;
  status?: 'operational' | 'planned';
}

interface HFRowsResponse {
  rows: Array<{ row: Record<string, unknown> }>;
  num_rows_total: number;
}

async function fetchPage(config: string, offset: number, length: number): Promise<HFRowsResponse> {
  const url = `${HF_BASE_URL}?dataset=${encodeURIComponent(HF_DATASET)}&config=${config}&split=train&offset=${offset}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF API ${res.status}: ${res.statusText}`);
  return await res.json() as HFRowsResponse;
}

async function main() {
  console.log(`Fetching gateways from HF dataset ${HF_DATASET}...`);

  const stations: Station[] = [];
  const pageSize = 100;

  const first = await fetchPage('gateways', 0, pageSize);
  for (const { row } of first.rows) {
    stations.push({
      name: String(row.name ?? ''),
      lat: Number(row.lat),
      lon: Number(row.lon),
      status: (row.status as Station['status']) ?? 'operational',
    });
  }

  const total = first.num_rows_total;
  for (let offset = pageSize; offset < total; offset += pageSize) {
    const page = await fetchPage('gateways', offset, pageSize);
    for (const { row } of page.rows) {
      stations.push({
        name: String(row.name ?? ''),
        lat: Number(row.lat),
        lon: Number(row.lon),
        status: (row.status as Station['status']) ?? 'operational',
      });
    }
  }

  stations.sort((a, b) => a.name.localeCompare(b.name));

  const output = {
    lastUpdated: new Date().toISOString(),
    source: `https://huggingface.co/datasets/${HF_DATASET}`,
    stations,
  };

  writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));
  console.log(`Done. ${stations.length} stations saved to ${DATA_PATH}`);
}

main().catch(console.error);
