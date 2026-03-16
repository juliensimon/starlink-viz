import { initDatabase } from '@/lib/fleet/db';
import { queryShells, getRecordCount, getLastIngestDate } from '@/lib/fleet/queries';

export async function GET() {
  try {
    await initDatabase();
    const [shells, recordCount, lastIngest] = await Promise.all([
      queryShells(),
      getRecordCount(),
      getLastIngestDate(),
    ]);
    return Response.json({ shells, recordCount, lastIngest });
  } catch {
    return Response.json([], { status: 200 });
  }
}
