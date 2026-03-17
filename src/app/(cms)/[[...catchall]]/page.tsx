import { PlasmicComponent, ComponentRenderData, PlasmicRootProvider } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from '@/lib/plasmic';
import { notFound } from 'next/navigation';

/**
 * Catch-all route for Plasmic-managed pages.
 * 
 * Any page you create in Plasmic Studio (e.g. /help, /over-ons, /privacy)
 * will be served by this catch-all route automatically.
 * 
 * Your existing app routes (/, /overzicht, /betalingen, etc.) take priority
 * because they're defined as explicit routes — this catch-all only handles
 * routes that don't match an existing page.
 */

interface PageProps {
  params: { catchall?: string[] };
}

export default async function PlasmicCatchallPage({ params }: PageProps) {
  const plasmicPath = '/' + (params.catchall?.join('/') || '');

  // Try to fetch the Plasmic page data
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

/**
 * Generate static paths for all Plasmic pages at build time.
 */
export async function generateStaticParams() {
  const pages = await PLASMIC.fetchPages();
  return pages.map((page) => ({
    catchall: page.path === '/' ? undefined : page.path.substring(1).split('/'),
  }));
}
