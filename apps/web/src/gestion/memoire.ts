import {
  cleDocument,
  CreationLocationSchema,
  DemandeDocumentSchema,
  DocumentSchema,
  FinLocationSchema,
  IdentiteBailleurSchema,
  loyerDuMois,
  montantAcceptable,
  NouveauPaiementSchema,
  occupationDe,
  PREFERENCES_PAR_DEFAUT,
  PreferencesMenuSchema,
  refusFin,
  type BienGere,
  type DocumentComplet,
  type EtatGestion,
  type Locataire,
  type LocationGeree,
  type NouveauLocataire,
  type Paiement,
  type RefusFin,
} from '@loupe/gestion';

import { cleDuDocument, documentEnMemoire } from './memoire-documents';
import type { ClientGestion, CodeErreurGestion, ResultatGestion } from './types';

export type ActionGestion = keyof ClientGestion;

export interface OptionsGestionMemoire {
  readonly etat?: EtatGestion;
  /** Le contenu des documents de `etat.documents` (sans lui, un document listé reste introuvable). */
  readonly documents?: readonly DocumentComplet[];
  /** Force une erreur sur une action, pour vérifier son affichage. */
  readonly erreurs?: Partial<Record<ActionGestion, CodeErreurGestion>>;
  /** Horodatage des créations ; son jour borne la date des paiements. */
  readonly maintenant?: string;
}

export interface ClientGestionMemoire extends ClientGestion {
  /** Les données telles que le serveur les aurait enregistrées. */
  readonly donnees: () => EtatGestion;
  /** Chaque action appelée, dans l'ordre. */
  readonly appels: ActionGestion[];
}

export const ETAT_GESTION_VIDE: EtatGestion = {
  biens: [],
  locataires: [],
  locations: [],
  paiements: [],
  bailleur: null,
  documents: [],
  preferences: PREFERENCES_PAR_DEFAUT,
};

const INVALIDE = { ok: false, code: 'invalide' } as const;
const INTROUVABLE = { ok: false, code: 'introuvable' } as const;
const CODES_REFUS_FIN: Readonly<Record<RefusFin, CodeErreurGestion>> = {
  FIN_AVANT_ENTREE: 'fin_avant_entree',
  PAIEMENTS_APRES_SORTIE: 'paiements_apres_sortie',
};

/** Un client de gestion sans réseau, qui applique les mêmes règles que l'API : tests et aperçu. */
export function clientGestionMemoire(options: OptionsGestionMemoire = {}): ClientGestionMemoire {
  let donnees = options.etat ?? ETAT_GESTION_VIDE;
  const complets = new Map((options.documents ?? []).map((d) => [d.id, d]));
  const maintenant = options.maintenant ?? '2026-09-14T09:00:00.000Z';
  const aujourdhui = maintenant.slice(0, 10);
  const appels: ActionGestion[] = [];
  let compteur = 0;
  const identifiant = (prefixe: string): string => `${prefixe}-${String((compteur += 1))}`;
  const lireDocument = (id: string): ResultatGestion<DocumentComplet> => {
    const complet = complets.get(id);
    return complet === undefined ? INTROUVABLE : { ok: true, valeur: complet };
  };

  function executer<T>(
    action: ActionGestion,
    faire: () => ResultatGestion<T>,
  ): Promise<ResultatGestion<T>> {
    appels.push(action);
    const erreur = options.erreurs?.[action];
    return Promise.resolve(erreur === undefined ? faire() : { ok: false, code: erreur });
  }

  return {
    appels,
    donnees: () => donnees,
    etat: () => executer('etat', () => ({ ok: true, valeur: donnees })),
    creer: (creation) =>
      executer('creer', () => {
        const lu = CreationLocationSchema.safeParse(creation);
        if (!lu.success) return INVALIDE;
        const bien: BienGere = {
          id: identifiant('bien'),
          ...lu.data.bien,
          creeLe: maintenant,
          modifieLe: maintenant,
        };
        const occupation = occupationDe(lu.data);
        let locataire: Locataire | null = null;
        let location: LocationGeree | null = null;
        let colocataires: Locataire[] = [];
        if (occupation !== null) {
          const enregistrer = (l: NouveauLocataire): Locataire => ({
            id: identifiant('locataire'),
            ...l,
            creeLe: maintenant,
          });
          locataire = enregistrer(occupation.locataire);
          colocataires = occupation.colocataires.map(enregistrer);
          location = {
            id: identifiant('location'),
            bienId: bien.id,
            locataireId: locataire.id,
            colocataireIds: colocataires.map((c) => c.id),
            ...occupation.location,
            creeLe: maintenant,
          };
        }
        donnees = {
          ...donnees,
          biens: [...donnees.biens, bien],
          locataires: [
            ...donnees.locataires,
            ...(locataire === null ? [] : [locataire]),
            ...colocataires,
          ],
          locations: location === null ? donnees.locations : [...donnees.locations, location],
        };
        return { ok: true, valeur: { bien, locataire, location, colocataires } };
      }),
    payer: (nouveau) =>
      executer('payer', () => {
        const lu = NouveauPaiementSchema.safeParse(nouveau);
        if (!lu.success) return INVALIDE;
        const location = donnees.locations.find((l) => l.id === lu.data.locationId);
        if (location === undefined) return INTROUVABLE;
        const du = loyerDuMois(location, lu.data.periode);
        if (du === null) return INVALIDE;
        if (lu.data.date > aujourdhui) return { ok: false, code: 'date_invalide' };
        if (!montantAcceptable(du, donnees.paiements, lu.data.montant)) {
          return { ok: false, code: 'montant_depasse' };
        }
        const paiement: Paiement = {
          id: identifiant('paiement'),
          ...lu.data,
          source: 'manuel',
          creeLe: maintenant,
        };
        donnees = { ...donnees, paiements: [...donnees.paiements, paiement] };
        return { ok: true, valeur: paiement };
      }),
    annulerPaiement: (id) =>
      executer('annulerPaiement', () => {
        const paiement = donnees.paiements.find((p) => p.id === id);
        if (paiement === undefined) return INTROUVABLE;
        const cles = [
          cleDocument({ type: 'recu', paiementId: id }),
          cleDocument({
            type: 'quittance',
            locationId: paiement.locationId,
            periode: paiement.periode,
          }),
        ];
        if (donnees.documents.some((d) => cles.includes(cleDuDocument(d)))) {
          return { ok: false, code: 'document_emis' };
        }
        donnees = { ...donnees, paiements: donnees.paiements.filter((p) => p.id !== id) };
        return { ok: true, valeur: undefined };
      }),
    enregistrerPreferences: (preferences) =>
      executer('enregistrerPreferences', () => {
        const lu = PreferencesMenuSchema.safeParse(preferences);
        if (!lu.success) return INVALIDE;
        donnees = { ...donnees, preferences: lu.data };
        return { ok: true, valeur: lu.data };
      }),
    enregistrerBailleur: (identite) =>
      executer('enregistrerBailleur', () => {
        const lu = IdentiteBailleurSchema.safeParse(identite);
        if (!lu.success) return INVALIDE;
        donnees = { ...donnees, bailleur: lu.data };
        return { ok: true, valeur: lu.data };
      }),
    emettreDocument: (demande) =>
      executer('emettreDocument', () => {
        const lu = DemandeDocumentSchema.safeParse(demande);
        if (!lu.success) return INVALIDE;
        const cle = cleDocument(lu.data);
        const existant = donnees.documents.find((d) => cleDuDocument(d) === cle);
        if (existant !== undefined) return lireDocument(existant.id);
        const emis = documentEnMemoire(donnees, lu.data, identifiant('document'), maintenant);
        if (emis.ok) {
          complets.set(emis.valeur.id, emis.valeur);
          donnees = {
            ...donnees,
            documents: [...donnees.documents, DocumentSchema.parse(emis.valeur)],
          };
        }
        return emis;
      }),
    document: (id) => executer('document', () => lireDocument(id)),
    terminerLocation: (locationId, fin) =>
      executer('terminerLocation', () => {
        const lu = FinLocationSchema.safeParse({ fin });
        if (!lu.success) return INVALIDE;
        const location = donnees.locations.find((l) => l.id === locationId);
        if (location === undefined) return INTROUVABLE;
        const refus = refusFin(location, lu.data.fin, donnees.paiements);
        if (refus !== null) return { ok: false, code: CODES_REFUS_FIN[refus] };
        const terminee: LocationGeree = { ...location, fin: lu.data.fin };
        donnees = {
          ...donnees,
          locations: donnees.locations.map((l) => (l.id === locationId ? terminee : l)),
        };
        return { ok: true, valeur: terminee };
      }),
  };
}
