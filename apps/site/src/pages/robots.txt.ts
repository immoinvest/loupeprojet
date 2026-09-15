import type { APIRoute } from 'astro';

import { urlAbsolue } from '../lib/site';

/** Tout est public ; le plan du site est généré par @astrojs/sitemap. */
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${urlAbsolue('/sitemap-index.xml')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
