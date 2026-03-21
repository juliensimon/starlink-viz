import { NextRequest } from 'next/server';
import { searchSatellites } from '@/lib/fleet/hf-dataset';

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q') || '';
    if (q.length < 2) return Response.json([]);
    const data = await searchSatellites(q);
    return Response.json(data);
  } catch (err) { console.error("[fleet]", err);
    return Response.json([]);
  }
}
