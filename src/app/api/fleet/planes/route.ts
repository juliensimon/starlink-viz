import { NextRequest } from 'next/server';
import { initDatabase } from '@/lib/fleet/db';
import { queryPlanes } from '@/lib/fleet/queries';

export async function GET(request: NextRequest) {
  try {
    initDatabase();
    const shell = request.nextUrl.searchParams.get('shell') || '2';
    const data = await queryPlanes(parseInt(shell));
    return Response.json(data);
  } catch {
    return Response.json([], { status: 200 });
  }
}
