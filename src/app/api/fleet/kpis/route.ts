import { getKpis } from '@/lib/fleet/hf-dataset';

export async function GET() {
  try {
    return Response.json(await getKpis());
  } catch {
    return Response.json({});
  }
}
