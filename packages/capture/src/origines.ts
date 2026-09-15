/**
 * Les adresses du site Deklic, en un seul endroit : web (bouton-favori, `og:image`, bascule),
 * extension (pont, popup), API des comptes et Worker (origines acceptées).
 */

/** L'adresse historique : le projet Cloudflare Pages `loupeprojet` (nom technique inchangé, ADR-005). */
export const ORIGINE_HISTORIQUE = 'https://loupeprojet.pages.dev';

/** L'adresse cible, une fois le domaine `deklic.pro` branché par Pierre (fiche de backlog 23). */
export const ORIGINE_DEKLIC = 'https://app.deklic.pro';

/** Les aperçus Cloudflare Pages : https://<branche ou empreinte>.loupeprojet.pages.dev. */
export const MOTIF_APERCUS = 'https://*.loupeprojet.pages.dev';

/** Adresse de production tant qu'aucune autre n'est donnée au build (`DEKLIC_ORIGINE`). */
export const ORIGINE_PRODUCTION_DEFAUT = ORIGINE_HISTORIQUE;

/** Les origines du site acceptées par les API : les deux adresses et les aperçus (`*` = un sous-domaine). */
export const ORIGINES_SITE: readonly string[] = [ORIGINE_HISTORIQUE, ORIGINE_DEKLIC, MOTIF_APERCUS];

/**
 * L'origine de production donnée au build : une adresse https réduite à son origine (sans chemin,
 * ni requête, ni fragment, ni identifiants), sinon la valeur par défaut.
 */
export function origineProduction(valeur: string | undefined): string {
  const texte = valeur?.trim() ?? '';
  if (texte === '') return ORIGINE_PRODUCTION_DEFAUT;
  let url: URL;
  try {
    url = new URL(texte);
  } catch {
    return ORIGINE_PRODUCTION_DEFAUT;
  }
  // Recomparer au texte écarte aussi majuscules, « ? » ou « # » vides et identifiants.
  const origineSeule = url.protocol === 'https:' && texte.replace(/\/$/, '') === url.origin;
  return origineSeule ? url.origin : ORIGINE_PRODUCTION_DEFAUT;
}
