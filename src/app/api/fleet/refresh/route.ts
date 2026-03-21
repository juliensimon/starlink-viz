import { spawn } from 'child_process';
import { clearCache } from '@/lib/fleet/hf-dataset';

/**
 * SSE endpoint — streams download progress from `hf download`.
 * Client connects with EventSource, receives progress events, then 'done'/'error'.
 */
export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      send('progress', 'Connecting to HF...');

      const proc = spawn('hf', [
        'download', 'juliensimon/starlink-fleet-data',
        '--repo-type', 'dataset',
        '--local-dir', 'data/dataset',
      ], { timeout: 120000 });

      let lastProgress = '';

      // hf download writes progress to stderr
      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (!text) return;

        // Parse progress percentage from hf download output
        // Format: "Fetching 5 files: 60%|██████    | 3/5 [00:01<00:00, 2.13it/s]"
        const pctMatch = text.match(/(\d+)%\|/);
        const fileMatch = text.match(/(\d+)\/(\d+)/);

        let msg: string;
        if (pctMatch && fileMatch) {
          msg = `Downloading: ${pctMatch[1]}% (${fileMatch[1]}/${fileMatch[2]} files)`;
        } else if (text.includes('Download complete')) {
          msg = text.replace(/.*Download complete\.\s*/, 'Downloaded: ').replace(/Moving file to /, '');
        } else if (text.includes('Fetching')) {
          msg = text.replace(/\|.*/, '').trim();
        } else {
          msg = text.slice(0, 80);
        }

        if (msg !== lastProgress) {
          lastProgress = msg;
          send('progress', msg);
        }
      });

      proc.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) send('progress', text.slice(0, 80));
      });

      proc.on('close', async (code) => {
        if (code === 0) {
          send('progress', 'Clearing cache...');
          await clearCache();
          send('done', 'Dataset refreshed');
        } else {
          send('error', `hf download exited with code ${code}`);
        }
        controller.close();
      });

      proc.on('error', (err) => {
        send('error', err.message);
        controller.close();
      });
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
