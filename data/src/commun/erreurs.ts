/** Message lisible d'une erreur quelle qu'en soit la forme (Error, chaîne, autre valeur levée). */
export function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}
