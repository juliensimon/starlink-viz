import { getShellsSummary } from '@/lib/fleet/hf-dataset';

export async function GET() {
  try {
    const data = await getShellsSummary();
    return Response.json(data);
  } catch {
    return Response.json({ shells: [], recordCount: 0, lastIngest: null });
  }
}
