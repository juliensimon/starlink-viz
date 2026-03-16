import dynamic from 'next/dynamic';

const FleetPage = dynamic(() => import('@/components/fleet/FleetPage').then((m) => m.FleetPage), { ssr: false });

export default function Fleet() {
  return <FleetPage />;
}
