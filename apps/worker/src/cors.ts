import { ORIGINE_DEKLIC, ORIGINE_HISTORIQUE } from '@loupe/capture/origines';

/** Origines autorisées par défaut : les deux adresses du site et le poste de développement. */
export const ORIGINES_DEFAUT: readonly string[] = [
  ORIGINE_HISTORIQUE,
  ORIGINE_DEKLIC,
  'http://localhost:5173',
];

/** Les previews Cloudflare Pages : https://<hash>.loupeprojet.pages.dev, https://<branche>.loupeprojet.pages.dev */
const PREVIEW_PAGES = /^https:\/\/[a-z0-9-]+\.loupeprojet\.pages\.dev$/;

export function origineAutorisee(origine: string, origines: readonly string[]): boolean {
  return origines.includes(origine) || PREVIEW_PAGES.test(origine);
}

/** « a, b ,c » → ['a', 'b', 'c'] ; les vides sont ignorés. */
export function lireOriginesSupplementaires(texte: string | undefined): string[] {
  if (texte === undefined) return [];
  return texte
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '');
}
