import { getVintageData } from '@/lib/fleet/hf-dataset';

export async function GET() {
  try {
    return Response.json(await getVintageData());
  } catch {
    return Response.json([]);
  }
}
