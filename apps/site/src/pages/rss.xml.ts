import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

import { publies } from '../lib/guides/controles';
import { SITE } from '../lib/site';

/** Flux des guides, du plus récemment mis à jour au plus ancien. */
export async function GET(): Promise<Response> {
  const guides = publies(await getCollection('guides'));
  return rss({
    title: 'Guides Deklic',
    description: SITE.description,
    site: SITE.origine,
    customData: '<language>fr-fr</language>',
    items: guides.map((guide) => ({
      title: guide.data.titre,
      description: guide.data.description,
      pubDate: guide.data.misAJourLe,
      link: `/guides/${guide.id}/`,
    })),
  });
}
