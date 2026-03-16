import { NextRequest } from 'next/server';
import { initDatabase } from '@/lib/fleet/db';
import { queryLaunches } from '@/lib/fleet/queries';

export async function GET(request: NextRequest) {
  try {
    initDatabase();
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const data = await queryLaunches(from, to);
    return Response.json(data);
  } catch {
    return Response.json([], { status: 200 });
  }
}
