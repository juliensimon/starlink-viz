/**
 * Fetches the latest Starlink ground station locations from starlinkinsider.com
 * and updates data/ground-stations.json.
 *
 * Usage: npx tsx scripts/update-ground-stations.ts
 *
 * The script scrapes the page for location names, then geocodes them
 * using the Nominatim API (OpenStreetMap, no API key needed).
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_PATH = join(import.meta.dirname, '..', 'data/ground-stations.json');
const SOURCE_URL = 'https://starlinkinsider.com/starlink-gateway-locations/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface Station {
  name: string;
  lat: number;
  lon: number;
}

interface DataFile {
  lastUpdated: string;
  source: string;
  stations: Station[];
}

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'StarLink-MissionControl/1.0' },
    });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.error(`  Geocode failed for "${query}":`, err);
  }
  return null;
}

function loadExisting(): DataFile {
  try {
    return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  } catch {
    return { lastUpdated: '', source: '', stations: [] };
  }
}

async function fetchStationNames(): Promise<string[]> {
  console.log(`Fetching station list from ${SOURCE_URL}...`);
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'StarLink-MissionControl/1.0' },
  });
  const html = await res.text();

  const names: string[] = [];

  // Match location names in list items or table cells
  const patterns = [
    /<li[^>]*>([^<]+(?:,\s*[^<]+))<\/li>/gi,
    /<td[^>]*>([^<]+(?:,\s*[^<]+))<\/td>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = match[1].trim();
      if (text.includes(',') && text.length > 3 && text.length < 80) {
        names.push(text);
      }
    }
  }

  return [...new Set(names)];
}

async function main() {
  const existing = loadExisting();
  console.log(`Existing: ${existing.stations.length} stations (last updated: ${existing.lastUpdated || 'never'})`);

  const existingMap = new Map<string, Station>();
  for (const s of existing.stations) {
    existingMap.set(s.name.toLowerCase(), s);
  }

  let newNames: string[] = [];
  try {
    newNames = await fetchStationNames();
    console.log(`Found ${newNames.length} potential station names from source`);
  } catch (err) {
    console.error('Failed to fetch station list, keeping existing data:', err);
    return;
  }

  const stations: Station[] = [...existing.stations];
  let added = 0;

  for (const name of newNames) {
    if (existingMap.has(name.toLowerCase())) continue;

    // Rate-limit Nominatim (1 req/sec policy)
    await new Promise((r) => setTimeout(r, 1100));

    console.log(`  Geocoding: ${name}`);
    const coords = await geocode(name);
    if (coords) {
      stations.push({ name, lat: coords.lat, lon: coords.lon });
      existingMap.set(name.toLowerCase(), { name, ...coords });
      added++;
      console.log(`    -> ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`);
    } else {
      console.log(`    -> Not found, skipping`);
    }
  }

  stations.sort((a, b) => a.name.localeCompare(b.name));

  const output: DataFile = {
    lastUpdated: new Date().toISOString(),
    source: SOURCE_URL,
    stations,
  };

  writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));
  console.log(`\nDone. ${stations.length} total stations (${added} new). Saved to ${DATA_PATH}`);
}

main().catch(console.error);
