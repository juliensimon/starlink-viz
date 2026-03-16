import { NextRequest } from 'next/server';
import { initDatabase } from '@/lib/fleet/db';
import { queryAltitudes } from '@/lib/fleet/queries';

export async function GET(request: NextRequest) {
  try {
    initDatabase();
    const date = request.nextUrl.searchParams.get('date') || undefined;
    const data = await queryAltitudes(date);
    return Response.json(data);
  } catch {
    return Response.json([], { status: 200 });
  }
}
