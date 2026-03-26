import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { clearCache } from '@/lib/fleet/hf-dataset';

const REPO = 'juliensimon/starlink-fleet-data';
const DATASET_DIR = join(process.cwd(), 'data/dataset/data');
const FILES = ['daily_snapshots.parquet', 'tle_snapshots.parquet', 'latest_satellites.parquet'];

/**
 * SSE endpoint — downloads parquet files from HF Hub via HTTP API.
 * No `hf` CLI dependency — works in Docker containers.
 */
export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      try {
        send('progress', 'Connecting to HF...');
        await mkdir(DATASET_DIR, { recursive: true });

        for (let i = 0; i < FILES.length; i++) {
          const file = FILES[i];
          send('progress', `Downloading ${i + 1}/${FILES.length}: ${file}`);

          const url = `https://huggingface.co/datasets/${REPO}/resolve/main/data/${file}`;
          const res = await fetch(url, { redirect: 'follow' });

          if (!res.ok) {
            send('error', `Failed to download ${file}: ${res.status} ${res.statusText}`);
            controller.close();
            return;
          }

          const buf = Buffer.from(await res.arrayBuffer());
          await writeFile(join(DATASET_DIR, file), buf);
          send('progress', `Downloaded ${file} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
        }

        send('progress', 'Clearing cache...');
        await clearCache();
        send('done', 'Dataset refreshed');
      } catch (err) {
        send('error', err instanceof Error ? err.message : String(err));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
