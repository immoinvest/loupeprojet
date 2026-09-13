import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Codes d'erreur propres au worker des comptes ; Better Auth rend ses propres `{ code, message }`. */
export type CodeErreur =
  | 'INTROUVABLE'
  | 'ORIGINE_INCONNUE'
  | 'TYPE_NON_PRIS_EN_CHARGE'
  | 'CHAMPS_INVALIDES'
  | 'COURRIEL_INDISPONIBLE'
  | 'CONFIGURATION_INCOMPLETE'
  | 'ERREUR_INTERNE';

/** Réponse JSON d'erreur, indépendante du contexte Hono (utilisable dans notFound, onError et index). */
export function reponseErreur(statut: ContentfulStatusCode, code: CodeErreur): Response {
  return new Response(JSON.stringify({ code }), {
    status: statut,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
}

/** Configuration (variables, bindings) invalide au démarrage : le worker refuse de servir. */
export class ErreurConfiguration extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurConfiguration';
  }
}

export function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}
