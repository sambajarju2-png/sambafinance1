import { PlasmicComponent, ComponentRenderData, PlasmicRootProvider } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from '@/lib/plasmic';
import { notFound } from 'next/navigation';

/**
 * /cms/[...catchall]
 * 
 * Plasmic-managed pages live under /cms/ prefix.
 * E.g. /cms/help, /cms/over-ons, /cms/privacy
 */
interface PageProps {
  params: { catchall?: string[] };
}

export default async function PlasmicCatchallPage({ params }: PageProps) {
  const plasmicPath = '/cms/' + (params.catchall?.join('/') || '');

  let plasmicData: ComponentRenderData | null = null;
  try {
    plasmicData = await PLASMIC.maybeFetchComponentData(plasmicPath);
  } catch {
    // Page doesn't exist in Plasmic
  }

  if (!plasmicData) {
    notFound();
  }

  return (
    <PlasmicRootProvider loader={PLASMIC} prefetchedData={plasmicData}>
      <PlasmicComponent component={plasmicPath} />
    </PlasmicRootProvider>
  );
}

export async function generateStaticParams() {
  const pages = await PLASMIC.fetchPages();
  return pages
    .filter((p) => p.path.startsWith('/cms/'))
    .map((page) => ({
      catchall: page.path.replace('/cms/', '').split('/'),
    }));
}
