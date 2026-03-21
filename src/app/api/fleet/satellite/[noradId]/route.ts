import { getSatelliteHistory } from '@/lib/fleet/hf-dataset';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noradId: string }> }
) {
  try {
    const { noradId } = await params;
    const data = await getSatelliteHistory(parseInt(noradId));
    return Response.json(data);
  } catch (err) { console.error("[fleet]", err);
    return Response.json([]);
  }
}
