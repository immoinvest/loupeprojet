import { ORIGINE_VITRINE } from '@loupe/capture/origines';

/** Identité du site vitrine : nom, adresse, description par défaut, auteur des guides. */
export const SITE = {
  nom: 'Deklic',
  origine: ORIGINE_VITRINE,
  langue: 'fr-FR',
  description:
    "Collez le lien d'une annonce immobilière : Deklic calcule crédit, cash-flow, impôts et revente, et compare le prix aux ventes réelles. Gratuit, sans compte.",
  auteur: { nom: 'Pierre Georgel', chemin: '/auteur/pierre-georgel/' },
  contact: 'contact@deklic.pro',
} as const;

/** Adresse complète d'une page du site. Refuse tout ce qui n'est pas un chemin (« /… ») du site. */
export function urlAbsolue(chemin: string): string {
  if (!chemin.startsWith('/') || chemin.startsWith('//')) {
    throw new Error(`Chemin du site attendu (« /… »), reçu « ${chemin} »`);
  }
  return new URL(chemin, SITE.origine).href;
}
