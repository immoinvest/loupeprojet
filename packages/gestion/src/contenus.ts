import {
  numeroDocument,
  type ContenuDocument,
  type IdentiteBailleur,
  type MentionDocument,
} from './documents';
import { loyerDuMois, type LoyerDu } from './loyers';
import type { BienGere, Locataire, LocationGeree, Paiement } from './schemas';

/** Ce qu'il faut pour écrire une quittance ou un reçu ; rien n'est relu ensuite (contenu figé). */
export interface EntreesDocument {
  readonly bailleur: IdentiteBailleur | null;
  readonly bien: Pick<BienGere, 'nom' | 'adresse'>;
  /** Le locataire en titre puis les colocataires, dans l'ordre du bail. */
  readonly locataires: readonly Pick<Locataire, 'prenom' | 'nom'>[];
  readonly location: Pick<
    LocationGeree,
    | 'id'
    | 'libelle'
    | 'debut'
    | 'fin'
    | 'jourLoyer'
    | 'loyerHorsCharges'
    | 'charges'
    | 'apl'
    | 'changements'
  >;
  /** Les paiements de la location (ceux des autres locations sont ignorés). */
  readonly paiements: readonly Paiement[];
  /** Jour d'émission. */
  readonly emisLe: string;
}

export type RefusDocument =
  'BAILLEUR_MANQUANT' | 'INTROUVABLE' | 'HORS_LOCATION' | 'LOYER_NON_REGLE' | 'LOYER_REGLE';

export type ResultatContenu =
  | { readonly ok: true; readonly contenu: ContenuDocument }
  | { readonly ok: false; readonly refus: RefusDocument };

/** Ordre des paiements d'un terme : par date, puis par création, puis par identifiant. */
function chronologique(a: Paiement, b: Paiement): number {
  return (
    a.date.localeCompare(b.date) || a.creeLe.localeCompare(b.creeLe) || a.id.localeCompare(b.id)
  );
}

function paiementsDuTerme(e: EntreesDocument, periode: string): Paiement[] {
  return e.paiements
    .filter((p) => p.locationId === e.location.id && p.periode === periode)
    .sort(chronologique);
}

function somme(paiements: readonly Paiement[]): number {
  return paiements.reduce((total, p) => total + p.montant, 0);
}

/** Les parties communes aux deux documents : qui, où, quel terme, quels montants dus. */
function socle(
  e: EntreesDocument & { readonly bailleur: IdentiteBailleur },
  du: LoyerDu,
): Pick<
  ContenuDocument,
  | 'emisLe'
  | 'bailleur'
  | 'locataires'
  | 'logement'
  | 'periode'
  | 'debut'
  | 'fin'
  | 'loyerHorsCharges'
  | 'charges'
  | 'total'
  | 'apl'
> {
  return {
    emisLe: e.emisLe,
    bailleur: { nom: e.bailleur.nom, adresse: e.bailleur.adresse },
    locataires: e.locataires.map((l) => ({ prenom: l.prenom, nom: l.nom })),
    logement: {
      nom: e.bien.nom,
      adresse: e.bien.adresse,
      ...(e.location.libelle === undefined ? {} : { libelle: e.location.libelle }),
    },
    periode: du.periode,
    debut: du.debut,
    fin: du.fin,
    loyerHorsCharges: du.loyerHorsCharges,
    charges: du.charges,
    total: du.total,
    // Sans aide, le contenu reste celui de G1b (ADR-G16).
    ...(du.apl > 0 ? { apl: du.apl } : {}),
  };
}

/** La quittance d'un terme entièrement reçu. */
export function contenuQuittance(e: EntreesDocument, periode: string): ResultatContenu {
  const { bailleur } = e;
  if (bailleur === null) return { ok: false, refus: 'BAILLEUR_MANQUANT' };
  const du = loyerDuMois(e.location, periode);
  if (du === null) return { ok: false, refus: 'HORS_LOCATION' };
  const siens = paiementsDuTerme(e, periode);
  const recu = somme(siens);
  if (siens.length === 0 || recu < du.total) return { ok: false, refus: 'LOYER_NON_REGLE' };
  const mentions: MentionDocument[] =
    siens.length > 1 ? ['pour_acquit', 'annule_recus'] : ['pour_acquit'];
  return {
    ok: true,
    contenu: {
      type: 'quittance',
      numero: numeroDocument('quittance', periode, e.location.id),
      ...socle({ ...e, bailleur }, du),
      paiements: siens.map((p) => ({ montant: p.montant, date: p.date })),
      montantRecu: recu,
      dejaRecu: 0,
      resteDu: 0,
      mentions,
    },
  };
}

/** Le reçu d'un paiement qui ne solde pas le terme (art. 21 : paiement partiel). */
export function contenuRecu(e: EntreesDocument, paiementId: string): ResultatContenu {
  const { bailleur } = e;
  if (bailleur === null) return { ok: false, refus: 'BAILLEUR_MANQUANT' };
  const paiement = e.paiements.find((p) => p.id === paiementId && p.locationId === e.location.id);
  if (paiement === undefined) return { ok: false, refus: 'INTROUVABLE' };
  const du = loyerDuMois(e.location, paiement.periode);
  if (du === null) return { ok: false, refus: 'HORS_LOCATION' };
  const siens = paiementsDuTerme(e, paiement.periode);
  const dejaRecu = somme(
    siens.slice(
      0,
      siens.findIndex((p) => p.id === paiementId),
    ),
  );
  if (dejaRecu + paiement.montant >= du.total) return { ok: false, refus: 'LOYER_REGLE' };
  return {
    ok: true,
    contenu: {
      type: 'recu',
      numero: numeroDocument('recu', paiement.periode, e.location.id, paiement.id),
      ...socle({ ...e, bailleur }, du),
      paiements: [{ montant: paiement.montant, date: paiement.date }],
      montantRecu: paiement.montant,
      dejaRecu,
      resteDu: du.total - dejaRecu - paiement.montant,
      mentions: [],
    },
  };
}
