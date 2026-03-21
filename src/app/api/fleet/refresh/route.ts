import { execFile } from 'child_process';
import { promisify } from 'util';
import { clearCache } from '@/lib/fleet/hf-dataset';

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    // Re-download dataset from HF
    await execFileAsync('hf', [
      'download', 'juliensimon/starlink-fleet-data',
      '--repo-type', 'dataset',
      '--local-dir', 'data/dataset',
    ], { timeout: 120000 });

    // Clear DuckDB connection so next request reads fresh Parquet files
    await clearCache();

    return Response.json({ ok: true, message: 'Dataset refreshed from HF' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
