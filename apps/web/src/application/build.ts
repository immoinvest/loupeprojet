/**
 * Réglages lus au build (vite.config.ts) : l'adresse de production écrite dans `index.html`
 * (`og:image`) et les drapeaux de la bascule vers app.deklic.pro. Sans `import.meta` : ce module
 * est aussi chargé par la configuration de Vite.
 */

/** Le jeton de `index.html` remplacé par l'origine de production au build. */
export const JETON_ORIGINE = '__ORIGINE_PRODUCTION__';

export function remplacerOrigine(html: string, origine: string): string {
  return html.replaceAll(JETON_ORIGINE, origine);
}

/** Un drapeau de build est levé par la valeur `1`, rien d'autre (`DEKLIC_TRANSFERT=1`). */
export function drapeauLeve(valeur: string | undefined): boolean {
  return valeur?.trim() === '1';
}
