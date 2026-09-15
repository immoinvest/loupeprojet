import { z } from 'astro/zod';

import { SLUGS_CATEGORIES } from './categories';

function texte(min: number, max: number): z.ZodString {
  return z.string().trim().min(min).max(max);
}

/**
 * Frontmatter d'un guide. Les longueurs suivent ce que Google affiche (title ≈ 60 caractères,
 * description 120 à 160) : un guide mal renseigné arrête le build au lieu d'être publié.
 */
export const SchemaGuide = z
  .object({
    /** Titre affiché (H1). */
    titre: texte(20, 90),
    /** Balise title, mot-clé principal au début. */
    titreSeo: texte(30, 65),
    description: texte(120, 160),
    motCle: texte(3, 80),
    motsClesSecondaires: z.array(texte(3, 80)).max(8).default([]),
    categorie: z.enum(SLUGS_CATEGORIES),
    auteur: z.literal('pierre-georgel'),
    publieLe: z.coerce.date(),
    misAJourLe: z.coerce.date(),
    /** « L'essentiel » : trois à cinq phrases qui répondent avant le détail. */
    essentiel: z.array(texte(20, 260)).min(3).max(5),
    faq: z
      .array(z.object({ question: texte(10, 140), reponse: texte(20, 600) }))
      .min(2)
      .max(8),
    sources: z
      .array(
        z.object({
          nom: texte(3, 160),
          url: z.url({ protocol: /^https$/ }),
          consulteLe: z.coerce.date(),
        }),
      )
      .min(1),
    brouillon: z.boolean().default(false),
  })
  .refine((guide) => guide.misAJourLe >= guide.publieLe, {
    message: 'La date de mise à jour ne peut pas précéder la date de publication',
    path: ['misAJourLe'],
  });

export type DonneesGuide = z.infer<typeof SchemaGuide>;
