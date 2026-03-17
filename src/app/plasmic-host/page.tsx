import { PlasmicCanvasHost } from '@plasmicapp/loader-nextjs';
import '@/lib/plasmic';

// Force dynamic rendering so this page is never statically generated
export const dynamic = 'force-dynamic';

export default function PlasmicHostPage() {
  return <PlasmicCanvasHost />;
}
