import { PeriodeSchema, type EtatGestion } from '@loupe/gestion';

/*
 * Les adresses de Gérer, à un seul endroit (ADR-G19) : un objet = une adresse, et chaque écran
 * qui nomme un bien, un locataire, un mois ou un document y mène par ces fonctions.
 */

type Donnees = Pick<EtatGestion, 'biens' | 'locataires'>;

export const CHEMIN_GERER = '/gerer';
export const CHEMIN_MES_BIENS = '/gerer/biens';
export const CHEMIN_MES_LOCATAIRES = '/gerer/locataires';
export const CHEMIN_NOUVEAU_LOCATAIRE = '/gerer/locataires/nouveau';
export const CHEMIN_LOYERS = '/gerer/loyers';
/** La page publique où le locataire accepte les quittances par e-mail ; le jeton suit dans le fragment. */
export const CHEMIN_ACCORD = '/accord';

function avecRecherche(
  chemin: string,
  parametres: Readonly<Record<string, string | undefined>>,
): string {
  const recherche = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur !== undefined) recherche.set(cle, valeur);
  }
  const texte = recherche.toString();
  return texte === '' ? chemin : `${chemin}?${texte}`;
}

/** La fiche d'un bien ; `modifier` : la location dont le formulaire « Modifier » s'ouvre à l'arrivée. */
export function lienFicheBien(
  id: string,
  options: { readonly modifier?: string | undefined } = {},
): string {
  return avecRecherche(`${CHEMIN_MES_BIENS}/${encodeURIComponent(id)}`, {
    modifier: options.modifier,
  });
}

/** La fiche d'un locataire ; `modifier` : son formulaire s'ouvre à l'arrivée. */
export function lienFicheLocataire(
  id: string,
  options: { readonly modifier?: boolean } = {},
): string {
  return avecRecherche(`${CHEMIN_MES_LOCATAIRES}/${encodeURIComponent(id)}`, {
    modifier: options.modifier === true ? '1' : undefined,
  });
}

/** Le formulaire « Nouveau locataire », le bien déjà choisi, et la page où revenir après. */
export function lienNouveauLocataire(
  options: { readonly bienId?: string | undefined; readonly retour?: string | undefined } = {},
): string {
  return avecRecherche(CHEMIN_NOUVEAU_LOCATAIRE, { bien: options.bienId, retour: options.retour });
}

/** Les loyers d'un mois ; `bienId` : les lignes de ce bien sont mises en évidence. */
export function lienLoyers(
  options: { readonly periode?: string | undefined; readonly bienId?: string | undefined } = {},
): string {
  return avecRecherche(CHEMIN_LOYERS, { mois: options.periode, bien: options.bienId });
}

/** Une quittance ou un reçu, avec la page où revenir. */
export function lienDocument(id: string, retour: string): string {
  return avecRecherche(`/gerer/documents/${encodeURIComponent(id)}`, { retour });
}

/** La page affichée, telle qu'on la passe en `retour`. */
export function cheminDe(location: { readonly pathname: string; readonly search: string }): string {
  return `${location.pathname}${location.search}`;
}

export const RETOUR_MAX = 300;

function contientUnCaractereDeControle(texte: string): boolean {
  for (let i = 0; i < texte.length; i += 1) {
    const code = texte.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Le paramètre `retour` s'il désigne une page de Gérer, sinon `null` (ADR-G20) : jamais une autre
 * origine (`https://…`, `//…`, `/\…`), jamais une autre partie du site, jamais `..`.
 */
export function retourValide(valeur: string | null): string | null {
  if (valeur === null || valeur.length > RETOUR_MAX) return null;
  if (!/^\/gerer(?:[/?]|$)/.test(valeur)) return null;
  if (valeur.includes('//') || valeur.includes('\\') || valeur.includes('/.')) return null;
  return contientUnCaractereDeControle(valeur) ? null : valeur;
}

/** Où mène le lien de retour d'un document, dit par un code ; la phrase est dans les textes. */
export type CibleRetour =
  | { readonly type: 'loyers_du_mois' }
  | { readonly type: 'loyers'; readonly periode: string | null }
  | { readonly type: 'mes_biens' }
  | { readonly type: 'bien'; readonly nom: string }
  | { readonly type: 'mes_locataires' }
  | { readonly type: 'locataire'; readonly nom: string };

export interface DestinationRetour {
  readonly chemin: string;
  readonly cible: CibleRetour;
}

const RETOUR_PAR_DEFAUT: DestinationRetour = {
  chemin: CHEMIN_LOYERS,
  cible: { type: 'loyers', periode: null },
};

function identifiantDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function cibleDe(pathname: string, mois: string | null, donnees: Donnees): CibleRetour | null {
  switch (pathname) {
    case CHEMIN_GERER:
      return { type: 'loyers_du_mois' };
    case CHEMIN_LOYERS:
      return { type: 'loyers', periode: PeriodeSchema.safeParse(mois).success ? mois : null };
    case CHEMIN_MES_BIENS:
      return { type: 'mes_biens' };
    case CHEMIN_MES_LOCATAIRES:
      return { type: 'mes_locataires' };
  }
  const fiche = /^\/gerer\/(biens|locataires)\/([^/]+)$/.exec(pathname);
  if (fiche === null) return null;
  const id = identifiantDecode(String(fiche[2]));
  if (id === null) return null;
  if (fiche[1] === 'biens') {
    const bien = donnees.biens.find((b) => b.id === id);
    return bien === undefined ? null : { type: 'bien', nom: bien.nom };
  }
  const locataire = donnees.locataires.find((l) => l.id === id);
  return locataire === undefined
    ? null
    : { type: 'locataire', nom: `${locataire.prenom} ${locataire.nom}` };
}

/**
 * Le retour d'un document : la page d'origine si elle est valide et connue (un bien ou un
 * locataire encore là), sinon Tous les loyers.
 */
export function destinationRetour(retour: string | null, donnees: Donnees): DestinationRetour {
  const chemin = retourValide(retour);
  if (chemin === null) return RETOUR_PAR_DEFAUT;
  const adresse = new URL(chemin, 'https://deklic.invalid');
  const cible = cibleDe(adresse.pathname, adresse.searchParams.get('mois'), donnees);
  return cible === null ? RETOUR_PAR_DEFAUT : { chemin, cible };
}

/** Ce que « Nouveau locataire » passe à la page où il revient, pour le message « … loue … ». */
export interface LocationCreee {
  readonly locataireId: string;
  /** « Léa Bernard » (le locataire en titre). */
  readonly locataire: string;
  /** « Parking Prado », ou « Coloc Rouet · Chambre 2 ». */
  readonly bien: string;
}

export function etatLocationCreee(loue: LocationCreee): { readonly loue: LocationCreee } {
  return { loue };
}

function estTexte(objet: object, cle: string): boolean {
  return cle in objet && typeof (objet as Record<string, unknown>)[cle] === 'string';
}

/** La location créée que l'état de navigation apporte, ou `null`. */
export function locationCreee(etat: unknown): LocationCreee | null {
  if (typeof etat !== 'object' || etat === null || !('loue' in etat)) return null;
  const { loue } = etat;
  if (typeof loue !== 'object' || loue === null) return null;
  if (!['locataireId', 'locataire', 'bien'].every((cle) => estTexte(loue, cle))) return null;
  return loue as LocationCreee;
}
