import type { EntreeGuide } from '../src/lib/guides/controles';
import type { DonneesGuide } from '../src/lib/guides/schema';

/** Un guide de test : seules les données utiles au test changent. */
export function guide(id: string, donnees: Partial<DonneesGuide> = {}): EntreeGuide {
  return {
    id,
    data: {
      titre: `Guide ${id}`,
      titreSeo: `Guide ${id} pour tester les pages du site`,
      description: 'Description de test.',
      motCle: `mot-clé ${id}`,
      motsClesSecondaires: [],
      categorie: 'investir',
      auteur: 'pierre-georgel',
      publieLe: new Date('2026-09-01'),
      misAJourLe: new Date('2026-09-01'),
      essentiel: [],
      faq: [],
      sources: [],
      brouillon: false,
      ...donnees,
    },
  };
}
