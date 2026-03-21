/**
 * Regenerates the FALLBACK_STATIONS array in src/lib/satellites/ground-stations.ts
 * from data/ground-stations.json.
 *
 * Usage: npx tsx scripts/sync-fallback.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = import.meta.dirname ? join(import.meta.dirname, '..') : process.cwd();
const JSON_PATH = join(ROOT, 'data/ground-stations.json');
const TS_PATH = join(ROOT, 'src/lib/satellites/ground-stations.ts');

// 1. Read the JSON source
const jsonData = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
const stations: { name: string; lat: number; lon: number; status: string; type?: string }[] = jsonData.stations;

if (!stations || stations.length === 0) {
  console.error('No stations found in', JSON_PATH);
  process.exit(1);
}

// 2. Read the existing TS file
const tsContent = readFileSync(TS_PATH, 'utf-8');

// 3. Find the FALLBACK_STATIONS array bounds
const startMarker = 'const FALLBACK_STATIONS: GroundStation[] = [';
const startIdx = tsContent.indexOf(startMarker);
if (startIdx === -1) {
  console.error('Could not find FALLBACK_STATIONS array in', TS_PATH);
  process.exit(1);
}

const arrayBodyStart = startIdx + startMarker.length;
const closingIdx = tsContent.indexOf('];', arrayBodyStart);
if (closingIdx === -1) {
  console.error('Could not find closing ]; for FALLBACK_STATIONS array');
  process.exit(1);
}

// 4. Generate new array entries
const lines = stations.map((s) => {
  const typeField = s.type === 'pop' ? ", type: 'pop'" : '';
  return `  { name: ${JSON.stringify(s.name)}, lat: ${s.lat}, lon: ${s.lon}, status: '${s.status}'${typeField} },`;
});

const newArrayBody = '\n' + lines.join('\n') + '\n';

// 5. Replace the array content
const newTsContent = tsContent.slice(0, arrayBodyStart) + newArrayBody + tsContent.slice(closingIdx);

// 6. Count what changed
const oldStationCount = (tsContent.slice(arrayBodyStart, closingIdx).match(/\{ name:/g) || []).length;
const newStationCount = stations.length;

// 7. Write the updated file
writeFileSync(TS_PATH, newTsContent, 'utf-8');

// 8. Summary
console.log(`Synced FALLBACK_STATIONS in ${TS_PATH}`);
console.log(`  Previous: ${oldStationCount} stations`);
console.log(`  Updated:  ${newStationCount} stations`);
if (newStationCount !== oldStationCount) {
  const diff = newStationCount - oldStationCount;
  console.log(`  Delta:    ${diff > 0 ? '+' : ''}${diff}`);
} else {
  console.log('  No change in station count.');
}
