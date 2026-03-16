import { initDatabase } from '@/lib/fleet/db';
import { querySatelliteHistory } from '@/lib/fleet/queries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noradId: string }> }
) {
  try {
    initDatabase();
    const { noradId } = await params;
    const data = await querySatelliteHistory(parseInt(noradId));
    return Response.json(data);
  } catch {
    return Response.json([], { status: 200 });
  }
}
