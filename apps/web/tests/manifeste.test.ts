import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { PARAMETRES_PARTAGE } from '@/annonces';
import { ACTION_PARTAGE } from '@/hors-ligne';

import texteManifeste from '../public/manifest.webmanifest?raw';

/** Les images de public/ que Vite connaît : seules les clés servent, pour savoir qu'un fichier existe. */
const IMAGES_PUBLIQUES = Object.keys(import.meta.glob('../public/*.png'));

const IconeSchema = z.object({
  src: z.string(),
  sizes: z.string(),
  type: z.literal('image/png'),
  purpose: z.enum(['any', 'maskable']).optional(),
});

const ManifesteSchema = z.object({
  id: z.string(),
  name: z.string(),
  short_name: z.string(),
  lang: z.string(),
  start_url: z.string(),
  scope: z.string(),
  display: z.string(),
  theme_color: z.string(),
  background_color: z.string(),
  icons: z.array(IconeSchema),
  shortcuts: z.array(z.object({ name: z.string(), url: z.string() })),
  share_target: z.object({
    action: z.string(),
    method: z.string(),
    params: z.object({ title: z.string(), text: z.string(), url: z.string() }),
  }),
});

function lireManifeste(): z.infer<typeof ManifesteSchema> {
  return ManifesteSchema.parse(JSON.parse(texteManifeste));
}

describe('Manifeste de l’application', () => {
  it('déclare une application installable, en français, qui s’ouvre sur Deklic', () => {
    expect(lireManifeste()).toMatchObject({
      id: '/',
      name: 'Deklic',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: 'fr',
      theme_color: '#2b4bf2',
      background_color: '#fffdf9',
    });
  });

  it('fournit les icônes 192 et 512 px, normales et adaptatives, présentes dans public/', () => {
    const { icons } = lireManifeste();
    for (const purpose of ['any', 'maskable'] as const) {
      for (const sizes of ['192x192', '512x512']) {
        const icone = icons.find((i) => (i.purpose ?? 'any') === purpose && i.sizes === sizes);
        expect(icone, `icône ${purpose} ${sizes}`).toBeDefined();
      }
    }
    for (const icone of icons) {
      expect(IMAGES_PUBLIQUES, icone.src).toContain(`../public${icone.src}`);
    }
  });

  it('propose les raccourcis « Nouveau projet » et « Mes projets »', () => {
    expect(lireManifeste().shortcuts.map((r) => [r.name, r.url])).toEqual([
      ['Nouveau projet', '/projets/nouveau'],
      ['Mes projets', '/projets'],
    ]);
  });

  it('reçoit les annonces partagées depuis les apps des portails, dans Nouveau projet', () => {
    expect(lireManifeste().share_target).toEqual({
      action: ACTION_PARTAGE,
      method: 'GET',
      params: {
        title: PARAMETRES_PARTAGE.titre,
        text: PARAMETRES_PARTAGE.texte,
        url: PARAMETRES_PARTAGE.lien,
      },
    });
  });
});
