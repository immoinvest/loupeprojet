import type {
  CreationLocation,
  CreationReponse,
  DemandeDocument,
  DocumentComplet,
  EtatGestion,
  IdentiteBailleur,
  LocationGeree,
  ModificationLocation,
  NouveauPaiement,
  NouvelleOccupation,
  OccupationCreee,
  Paiement,
  PreferencesMenu,
} from '@loupe/gestion';

/** Erreurs traduites en codes stables ; les phrases sont dans `textes/gerer.ts`. */
export type CodeErreurGestion =
  | 'non_connecte'
  | 'invalide'
  | 'introuvable'
  /** Le paiement ferait dépasser ce qui est dû pour le mois. */
  | 'montant_depasse'
  /** Un paiement daté dans le futur. */
  | 'date_invalide'
  /** Un paiement attesté par une quittance ou un reçu ne s'annule plus. */
  | 'document_emis'
  | 'bailleur_manquant'
  | 'loyer_non_regle'
  | 'loyer_regle'
  | 'bien_occupe'
  | 'fin_avant_entree'
  | 'paiements_apres_sortie'
  /** Un paiement existe pour le mois des nouveaux montants ou après. */
  | 'periode_payee'
  | 'limite'
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
  enregistrerBailleur(identite: IdentiteBailleur): Promise<ResultatGestion<IdentiteBailleur>>;
  /** Émet la quittance d'un mois ou le reçu d'un paiement ; rend le même document s'il existe déjà. */
  emettreDocument(demande: DemandeDocument): Promise<ResultatGestion<DocumentComplet>>;
  document(id: string): Promise<ResultatGestion<DocumentComplet>>;
  /** Enregistre (ou déplace) la date de sortie du locataire. */
  terminerLocation(locationId: string, fin: string): Promise<ResultatGestion<LocationGeree>>;
  /** Loue un bien existant : vacant, ou une autre chambre ; refusé si la même chambre est déjà louée. */
  louer(bienId: string, occupation: NouvelleOccupation): Promise<ResultatGestion<OccupationCreee>>;
  /** Montants à partir d'un mois non payé, jour du loyer, dépôt, libellé. */
  modifierLocation(
    locationId: string,
    modification: ModificationLocation,
  ): Promise<ResultatGestion<LocationGeree>>;
  /** Supprime le bien, ses locations, paiements et documents, et ses locataires sans autre location. */
  supprimerBien(bienId: string): Promise<ResultatGestion>;
}
