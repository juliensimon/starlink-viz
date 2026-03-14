import { NextResponse } from 'next/server';
import { GROUND_STATIONS } from '@/lib/satellites/ground-stations';

export async function GET() {
  return NextResponse.json({
    count: GROUND_STATIONS.length,
    stations: GROUND_STATIONS,
  });
}
