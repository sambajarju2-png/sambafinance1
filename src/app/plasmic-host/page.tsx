'use client';

import dynamic from 'next/dynamic';
import '@/lib/plasmic';

const PlasmicCanvasHost = dynamic(
  () => import('@plasmicapp/loader-nextjs').then((mod) => mod.PlasmicCanvasHost),
  { ssr: false }
);

export default function PlasmicHostPage() {
  return <PlasmicCanvasHost />;
}
