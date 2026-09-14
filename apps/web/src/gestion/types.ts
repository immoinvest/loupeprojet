import type {
  CreationLocation,
  CreationReponse,
  EtatGestion,
  NouveauPaiement,
  Paiement,
  PreferencesMenu,
} from '@loupe/gestion';

/** Erreurs traduites en codes stables ; les phrases sont dans `textes/gerer.ts`. */
export type CodeErreurGestion =
  | 'non_connecte'
  | 'invalide'
  | 'introuvable'
  | 'deja_recu'
  | 'indisponible'
  | 'reseau'
  | 'inconnue';

export type ResultatGestion<T = undefined> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly code: CodeErreurGestion };

/** Ce dont les écrans de Gérer ont besoin ; une version réseau (l'API) et une version mémoire (tests). */
export interface ClientGestion {
  etat(): Promise<ResultatGestion<EtatGestion>>;
  creer(creation: CreationLocation): Promise<ResultatGestion<CreationReponse>>;
  payer(paiement: NouveauPaiement): Promise<ResultatGestion<Paiement>>;
  annulerPaiement(paiementId: string): Promise<ResultatGestion>;
  enregistrerPreferences(preferences: PreferencesMenu): Promise<ResultatGestion<PreferencesMenu>>;
}
