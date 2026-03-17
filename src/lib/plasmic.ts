import { initPlasmicLoader } from '@plasmicapp/loader-nextjs';

export const PLASMIC = initPlasmicLoader({
  projects: [
    {
      id: process.env.NEXT_PUBLIC_PLASMIC_ID || 'rnpvG5G9AhRjJXRDnEcBRe',
      token: process.env.NEXT_PUBLIC_PLASMIC_TOKEN || '6eXeHWIORNfmQ0zhSrunaR0BDJjJzgD0fKqWuthIqcFZXNWDu7qwyloDJrWOj5y09aUPGQWqRmFpL9ydFePA',
    },
  ],
  // Serve pages at these URL prefixes
  preview: process.env.NODE_ENV === 'development',
});
