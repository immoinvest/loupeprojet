import {
  accordValide,
  JetonAccordSchema,
  locatairesAVerifier,
  TelephoneSchema,
  type AccordLocataire,
  type BailleurBien,
  type DocumentGestion,
  type Envoi,
  type EtatEnvois,
} from '@loupe/gestion';

/** Ce que les écrans de Gérer lisent de l'état des envois : calculé à l'affichage, jamais stocké. */

export function accordDe(
  etat: EtatEnvois | null,
  locataireId: string,
): AccordLocataire | undefined {
  return etat?.accords.find((a) => a.locataireId === locataireId);
}

export function telephoneDe(etat: EtatEnvois | null, locataireId: string): string | undefined {
  return etat?.contacts.find((c) => c.locataireId === locataireId)?.telephone;
}

export function bailleurDuBien(etat: EtatEnvois | null, bienId: string): BailleurBien | undefined {
  const trouve = etat?.bailleursBiens.find((b) => b.bienId === bienId);
  return trouve === undefined
    ? undefined
    : { type: trouve.type, nom: trouve.nom, adresse: trouve.adresse };
}

export interface TraceQuittance {
  readonly document: DocumentGestion;
  readonly envois: readonly Envoi[];
}

/** La quittance d'un mois et ses envois ; `null` si elle n'a jamais été envoyée. */
export function traceDuLoyer(
  etat: EtatEnvois | null,
  documents: readonly DocumentGestion[],
  locationId: string,
  periode: string,
): TraceQuittance | null {
  const document = documents.find(
    (d) => d.type === 'quittance' && d.locationId === locationId && d.periode === periode,
  );
  if (document === undefined || etat === null) return null;
  const envois = etat.envois.filter((e) => e.documentId === document.id);
  return envois.length === 0 ? null : { document, envois };
}

/** Un locataire du bail au moins a accepté les quittances par e-mail. */
export function quittancePartira(
  etat: EtatEnvois | null,
  location: { readonly locataireId: string; readonly colocataireIds: readonly string[] },
): boolean {
  if (etat === null || etat.mode === 'inactif') return false;
  return [location.locataireId, ...location.colocataireIds].some((id) => {
    const accord = accordDe(etat, id);
    return accord !== undefined && accordValide(accord.statut);
  });
}

export interface ActionsEnvois {
  /** Invités qui n'ont pas encore répondu, pas encore vus sur leur fiche. */
  readonly enAttente: readonly string[];
  /** Le dernier envoi a échoué. */
  readonly aVerifier: readonly string[];
}

export const SANS_ACTIONS_ENVOIS: ActionsEnvois = { enAttente: [], aVerifier: [] };

export function actionsEnvois(etat: EtatEnvois | null, vus: readonly string[]): ActionsEnvois {
  if (etat === null) return SANS_ACTIONS_ENVOIS;
  return {
    enAttente: etat.accords
      .filter((a) => a.statut === 'en_attente' && !vus.includes(a.locataireId))
      .map((a) => a.locataireId),
    aVerifier: locatairesAVerifier(etat.envois),
  };
}

const CLE_ACCORDS_VUS = 'deklic.gerer.accords-vus.v1';

/** Le stockage du navigateur, ou `undefined` s'il est bloqué. */
export function stockageLocal(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** « Une seule fois » (G2-1) : les locataires en attente dont la fiche a déjà été ouverte. */
export function lireAccordsVus(stockage: Storage | undefined): string[] {
  try {
    const valeur: unknown = JSON.parse(stockage?.getItem(CLE_ACCORDS_VUS) ?? '[]');
    return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function marquerAccordVu(stockage: Storage | undefined, locataireId: string): void {
  const vus = lireAccordsVus(stockage);
  if (vus.includes(locataireId)) return;
  try {
    stockage?.setItem(CLE_ACCORDS_VUS, JSON.stringify([...vus, locataireId].slice(-200)));
  } catch {
    // Stockage plein ou bloqué : la ligne reviendra dans « À faire », rien de grave.
  }
}

export type SaisieTelephone =
  { readonly ok: true; readonly telephone: string | null } | { readonly ok: false };

/** Vide = pas de téléphone ; sinon un numéro plausible. */
export function telephoneDepuisSaisie(texte: string): SaisieTelephone {
  const nettoye = texte.trim();
  if (nettoye === '') return { ok: true, telephone: null };
  const lu = TelephoneSchema.safeParse(nettoye);
  return lu.success ? { ok: true, telephone: lu.data } : { ok: false };
}

/** Le jeton du lien d'accord, lu dans le fragment (`#…`) ; `null` s'il est absent ou mal formé. */
export function jetonDuFragment(fragment: string): string | null {
  const lu = JetonAccordSchema.safeParse(fragment.replace(/^#/, ''));
  return lu.success ? lu.data : null;
}
