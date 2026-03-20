import { NextRequest } from 'next/server';
import { getAltitudeData } from '@/lib/fleet/hf-dataset';

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date') || undefined;
    const data = await getAltitudeData(date);
    return Response.json(data);
  } catch {
    return Response.json([]);
  }
}
