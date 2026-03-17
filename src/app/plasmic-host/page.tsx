import * as React from 'react';
import { PlasmicCanvasHost } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from '@/lib/plasmic';

/**
 * /plasmic-host
 * 
 * This page is used by Plasmic Studio to connect to your app.
 * It loads your registered components so you can drag and drop them in the editor.
 * 
 * DO NOT delete this file — Plasmic Studio needs it.
 */
export default function PlasmicHost() {
  return <PlasmicCanvasHost />;
}
