import { NextRequest } from 'next/server';
import { getLaunchData } from '@/lib/fleet/hf-dataset';

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get('from') || undefined;
    const to = request.nextUrl.searchParams.get('to') || undefined;
    const data = await getLaunchData(from, to);
    return Response.json(data);
  } catch {
    return Response.json([]);
  }
}
