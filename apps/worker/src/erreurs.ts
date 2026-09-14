import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Codes d'erreur du Worker : l'interface les transforme en phrases, le Worker n'écrit jamais de texte. */
export type CodeErreur =
  | 'INTROUVABLE'
  | 'SERVICE_INCONNU'
  | 'PARAMETRES_INVALIDES'
  | 'TROP_DE_REQUETES'
  | 'AMONT_INDISPONIBLE'
  | 'AMONT_SATURE'
  | 'AMONT_INVALIDE'
  | 'EXTRACTION_INDISPONIBLE'
  | 'LECTURE_INDISPONIBLE'
  | 'ORIGINE_REFUSEE'
  | 'ANNONCE_INTROUVABLE'
  | 'AMONT_VIDE'
  | 'ERREUR_INTERNE';

export interface CorpsErreur {
  readonly code: CodeErreur;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Réponse JSON d'erreur, indépendante du contexte Hono (utilisable dans les middlewares et onError). */
export function reponseErreur(
  statut: ContentfulStatusCode,
  code: CodeErreur,
  details?: Readonly<Record<string, unknown>>,
): Response {
  const corps: CorpsErreur = details === undefined ? { code } : { code, details };
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
}

/** Configuration (variables, bindings) invalide au démarrage : le Worker refuse de servir. */
export class ErreurConfiguration extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurConfiguration';
  }
}

/** Réponse amont qui ne correspond pas au contrat attendu. */
export class ErreurAmontInvalide extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurAmontInvalide';
  }
}

export function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}
