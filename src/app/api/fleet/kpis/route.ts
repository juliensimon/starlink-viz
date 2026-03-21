import { getKpis } from '@/lib/fleet/hf-dataset';

export async function GET() {
  try {
    return Response.json(await getKpis());
  } catch (err) { console.error("[fleet]", err);
    return Response.json({});
  }
}
