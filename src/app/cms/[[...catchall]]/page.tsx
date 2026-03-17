import { PlasmicComponent, PlasmicRootProvider } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from '@/lib/plasmic';
import { notFound } from 'next/navigation';

// Never statically generate CMS pages — always fetch fresh from Plasmic
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { catchall?: string[] };
}

export default async function PlasmicCatchallPage({ params }: PageProps) {
  const plasmicPath = '/cms/' + (params.catchall?.join('/') || '');

  try {
    const plasmicData = await PLASMIC.maybeFetchComponentData(plasmicPath);

    if (!plasmicData) {
      notFound();
    }

    return (
      <PlasmicRootProvider loader={PLASMIC} prefetchedData={plasmicData}>
        <PlasmicComponent component={plasmicPath} />
      </PlasmicRootProvider>
    );
  } catch {
    notFound();
  }
}
