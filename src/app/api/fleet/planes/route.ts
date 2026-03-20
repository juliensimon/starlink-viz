import { NextRequest } from 'next/server';
import { getPlaneData } from '@/lib/fleet/hf-dataset';

export async function GET(request: NextRequest) {
  try {
    const shell = request.nextUrl.searchParams.get('shell') || '2';
    const data = await getPlaneData(parseInt(shell));
    return Response.json(data);
  } catch {
    return Response.json([]);
  }
}
