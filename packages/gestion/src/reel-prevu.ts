import {
  calculerProjet,
  migrerProjet,
  ProjetSchema,
  type CodeCharge,
  type Projet,
  type Regime,
} from '@loupe/moteur';

import type { BilanArgent } from './argent';
import { ajouterMois, periodeDe } from './dates';
import { moisEntre } from './pret';
import type { BienGere } from './schemas';

/*
 * Le réel contre le prévu d'un bien venu d'une analyse (G5-2, ADR-G35 et G36). Le prévu est recalculé
 * par le moteur sur l'instantané du projet, avec sa version de règles ; le réel est la moyenne
 * mensuelle d'Argent sur les derniers mois complets. Tout en centimes par mois, rien de stocké.
 */

/** Les postes comparés : ce qui entre, puis ce qui sort, dans l'ordre d'affichage. */
export const POSTES_REEL = [
  'loyers',
  'mensualites',
  'taxe_fonciere',
  'copropriete',
  'assurance',
  'travaux',
  'entretien',
  'gestion',
  'autre',
] as const;
export type PosteReel = (typeof POSTES_REEL)[number];
export type MontantsParPoste = Readonly<Record<PosteReel, number>>;

/** Des montants mensuels par poste et le cash-flow qu'ils font (loyers − tout le reste). */
export interface Mensuel {
  readonly postes: MontantsParPoste;
  readonly cashflow: number;
}

export type RaisonSansPrevu = 'sans_analyse' | 'illisible' | 'sans_loyer';

export type Prevu =
  | (Mensuel & { readonly ok: true; readonly versionRegles: string })
  | { readonly ok: false; readonly raison: RaisonSansPrevu };

/** Où va chaque ligne de charges du moteur parmi les catégories de dépenses de Gérer. */
const POSTE_DE_CHARGE: Readonly<Record<CodeCharge, PosteReel>> = {
  taxeFonciere: 'taxe_fonciere',
  copro: 'copropriete',
  pno: 'assurance',
  comptable: 'gestion',
  cfe: 'autre',
  gestion: 'gestion',
  conciergerie: 'gestion',
  plateforme: 'gestion',
  menage: 'autre',
  energie: 'autre',
  internet: 'autre',
  entretien: 'entretien',
};

/** Écart d'un poste retenu parmi les principaux : 1 € par mois au moins. */
export const ECART_MINIMUM = 100;

function postesAZero(): Record<PosteReel, number> {
  return Object.fromEntries(POSTES_REEL.map((p) => [p, 0])) as Record<PosteReel, number>;
}

/** Loyers moins tout le reste. */
export function cashflowDesPostes(postes: MontantsParPoste): number {
  return POSTES_REEL.reduce(
    (total, poste) => (poste === 'loyers' ? total + postes[poste] : total - postes[poste]),
    0,
  );
}

/** L'instantané du projet d'un bien, migré et validé ; `null` sans instantané ou s'il est illisible. */
export function projetDuBien(bien: Pick<BienGere, 'projet'>): Projet | null {
  if (bien.projet === undefined) return null;
  const lu = ProjetSchema.safeParse(migrerProjet(bien.projet));
  return lu.success ? lu.data : null;
}

/** Le régime fiscal retenu dans l'analyse du bien, s'il y en a une lisible. */
export function regimeDeLAnalyse(bien: Pick<BienGere, 'projet'>): Regime | null {
  return projetDuBien(bien)?.hypotheses.fiscalite.regime ?? null;
}

/** Un montant annuel du moteur (euros décimaux) ramené au mois, en centimes. */
function mensuelEnCentimes(annuelEuros: number): number {
  return Math.round((annuelEuros / 12) * 100);
}

/**
 * Le prévu mensuel de l'analyse. Loyers encaissés = loyers nets de vacance ÷ 12, plus les charges
 * refacturées au locataire (nue et meublée) ; ces charges s'ajoutent aussi à la copropriété : Argent
 * compte les paiements charges comprises et la copropriété entière (ADR-G35).
 */
export function prevuDuBien(bien: Pick<BienGere, 'projet'>): Prevu {
  if (bien.projet === undefined) return { ok: false, raison: 'sans_analyse' };
  const projet = projetDuBien(bien);
  if (projet === null) return { ok: false, raison: 'illisible' };
  const resultats = calculerProjet(projet, { avecScenarios: false });
  if (!resultats.complet) return { ok: false, raison: 'sans_loyer' };
  const { location } = projet.hypotheses;
  const refacturees =
    location.mode === 'nu' || location.mode === 'meuble'
      ? Math.round(location.chargesLocataire * 100)
      : 0;
  const postes = postesAZero();
  postes.loyers = mensuelEnCentimes(resultats.cashflow.recettes.loyersNets) + refacturees;
  for (const ligne of resultats.cashflow.charges) {
    postes[POSTE_DE_CHARGE[ligne.code]] += mensuelEnCentimes(ligne.annuel);
  }
  postes.copropriete += refacturees;
  postes.mensualites = Math.round(resultats.financement.mensualiteTotale * 100);
  return {
    ok: true,
    postes,
    cashflow: cashflowDesPostes(postes),
    versionRegles: projet.versionRegles,
  };
}

export interface PeriodeComparaison {
  readonly debut: string;
  readonly fin: string;
  readonly mois: number;
}

/**
 * Les mois comparés (ADR-G36) : les `nombre` derniers mois complets (le mois en cours exclu), sans
 * remonter avant le mois qui suit l'ajout du bien (souvent incomplet) ; `null` s'il n'y en a aucun.
 */
export function moisDeComparaison(
  bien: Pick<BienGere, 'creeLe'>,
  aujourdhui: string,
  nombre = 12,
): PeriodeComparaison | null {
  const fin = ajouterMois(periodeDe(aujourdhui), -1);
  const apresAjout = ajouterMois(periodeDe(bien.creeLe.slice(0, 10)), 1);
  const plusAncien = ajouterMois(fin, 1 - nombre);
  const debut = apresAjout > plusAncien ? apresAjout : plusAncien;
  if (debut > fin) return null;
  return { debut, fin, mois: moisEntre(debut, fin) + 1 };
}

/** Le réel mensuel moyen d'un bilan d'Argent sur `mois` mois ; « Crédit » va avec les mensualités. */
export function reelMensuel(bilan: BilanArgent, mois: number): Mensuel {
  const c = bilan.depensesParCategorie;
  const parMois = (total: number): number => Math.round(total / mois);
  const postes: MontantsParPoste = {
    loyers: parMois(bilan.loyers),
    mensualites: parMois(bilan.mensualites + c.credit),
    taxe_fonciere: parMois(c.taxe_fonciere),
    copropriete: parMois(c.copropriete),
    assurance: parMois(c.assurance),
    travaux: parMois(c.travaux),
    entretien: parMois(c.entretien),
    gestion: parMois(c.gestion),
    autre: parMois(c.autre),
  };
  return { postes, cashflow: cashflowDesPostes(postes) };
}

export interface EcartPoste {
  readonly poste: PosteReel;
  readonly prevu: number;
  readonly reel: number;
  /** Effet sur le cash-flow : positif = mieux que prévu (plus de loyers, moins de dépenses). */
  readonly effet: number;
}

export interface ComparaisonReelPrevu {
  readonly prevu: Mensuel;
  readonly reel: Mensuel;
  /** Cash-flow réel − cash-flow prévu, par mois : négatif = moins que prévu. */
  readonly ecart: number;
  /** Les deux postes qui pèsent le plus sur l'écart, le plus lourd d'abord. */
  readonly principaux: readonly EcartPoste[];
}

export function comparerReelPrevu(prevu: Mensuel, reel: Mensuel): ComparaisonReelPrevu {
  const principaux = POSTES_REEL.map((poste): EcartPoste => {
    const avant = prevu.postes[poste];
    const apres = reel.postes[poste];
    return {
      poste,
      prevu: avant,
      reel: apres,
      effet: poste === 'loyers' ? apres - avant : avant - apres,
    };
  })
    .filter((e) => Math.abs(e.effet) >= ECART_MINIMUM)
    // Tri stable : à effet égal, l'ordre des postes.
    .sort((a, b) => Math.abs(b.effet) - Math.abs(a.effet))
    .slice(0, 2);
  return { prevu, reel, ecart: reel.cashflow - prevu.cashflow, principaux };
}
