import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { ORIGINE_VITRINE } from '@loupe/capture/origines';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import { verification } from './src/integrations/verification';
import { liensApplication } from './src/lib/liens';

/** La page 404 n'a rien à faire dans le plan du site. */
function horsPage404(page: string): boolean {
  return !/\/404\/?$/.test(page);
}

export default defineConfig({
  site: ORIGINE_VITRINE,
  trailingSlash: 'always',
  // Aucun style ni script inline : la CSP de _headers les refuse (src/lib/verification/en-tetes.ts).
  build: { format: 'directory', inlineStylesheets: 'never' },
  integrations: [
    mdx(),
    sitemap({ filter: horsPage404 }),
    verification({
      origineSite: ORIGINE_VITRINE,
      origineApplication: liensApplication(process.env.DEKLIC_ORIGINE).origine,
    }),
  ],
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
