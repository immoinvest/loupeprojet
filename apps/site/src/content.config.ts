import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

import { SchemaGuide } from './lib/guides/schema';

/** Les guides : un fichier MDX par guide dans contenu/guides/, frontmatter validé au build. */
const guides = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './contenu/guides' }),
  schema: SchemaGuide,
});

export const collections = { guides };
