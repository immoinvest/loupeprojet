import { obtenirRegles, VERSION_REGLES_COURANTE, type Regime, type Regles } from '@loupe/moteur';

import { argentDeLAnnee, type DonneesArgent } from './argent';
import type { Depense } from './depenses';
import { montantsDuMois } from './montants';
import { echeanceDuMois } from './pret';
import { regimeDeLAnalyse } from './reel-prevu';
import type { CategorieDepense } from './regles-argent';
import {
  ABATTEMENT_MINIMUM_MICRO_BIC,
  ANNEE_REVENUS_VERIFIEE,
  FORFAIT_GESTION_PAR_LOCAL,
} from './regles-declaration';
import type { BienGere } from './schemas';

/*
 * Aide à la déclaration d'une année civile de revenus (G5-3, ADR-G37). Biens loués vides : revenus
 * fonciers (micro-foncier ou réel 2044) ; biens meublés : BIC (micro-BIC ou LMNP au réel, recettes
 * seules). Taux et plafonds lus dans les règles du moteur, en euros, convertis en centimes ici. Rien
 * n'est télédéclaré ni stocké (G5-3 bis) : ce sont des montants à reporter, à vérifier.
 */

/** Ce qu'une année a encaissé, en centimes : loyers hors charges, charges, total. */
export interface RecettesAnnee {
  readonly loyers: number;
  readonly charges: number;
  readonly total: number;
}

/** Les lignes de frais et charges de la 2044 que Deklic sait remplir. */
export type LigneCharges2044 =
  'fraisGestion' | 'forfaitGestion' | 'assurance' | 'travaux' | 'taxeFonciere' | 'copropriete';

export interface MicroFoncier {
  readonly regime: 'micro_foncier';
  /** Loyers bruts encaissés hors charges (case 4BE). */
  readonly recettes: number;
  readonly abattementTaux: number;
  readonly abattement: number;
  readonly imposable: number;
  readonly plafond: number;
  /** Au-delà du plafond, le micro-foncier n'est pas possible (foyer entier : seuls les biens de Deklic sont comptés ici). */
  readonly depassePlafond: boolean;
}

export interface ReelFoncier {
  readonly regime: 'nu_reel';
  /** Ligne 211. */
  readonly loyers: number;
  readonly charges: Readonly<Record<LigneCharges2044, number>>;
  /** Ligne 240. */
  readonly totalCharges: number;
  /** Ligne 250 : intérêts et assurance des prêts des biens. */
  readonly interets: number;
  /** Ligne 420 : bénéfice (positif) ou déficit (négatif). */
  readonly resultat: number;
  /** Case 4BA. */
  readonly benefice: number;
  /** Case 4BC. */
  readonly deficitRevenuGlobal: number;
  /** Case 4BB. */
  readonly deficitRevenusFonciers: number;
  readonly plafondRevenuGlobal: number;
  /** Locaux donnés en location dans l'année (forfait de la ligne 222). */
  readonly locaux: number;
}

export interface MicroBic {
  readonly regime: 'micro_bic';
  /** Recettes encaissées, charges facturées comprises (case 5NI). */
  readonly recettes: number;
  readonly abattementTaux: number;
  readonly abattement: number;
  readonly imposable: number;
  readonly plafond: number;
  readonly depassePlafond: boolean;
}

export interface LmnpReel {
  readonly regime: 'lmnp_reel';
  /** Seules les recettes : le résultat (amortissements, liasse) relève d'un expert-comptable. */
  readonly recettes: number;
}

export type RegimeFoncier = MicroFoncier | ReelFoncier;
export type RegimeMeuble = MicroBic | LmnpReel;

export interface GroupeDeclaration<R extends { readonly regime: Regime }> {
  readonly biens: readonly BienGere[];
  readonly recettes: RecettesAnnee;
  /** Le régime retenu dans l'analyse d'un des biens du groupe, s'il y en a un de compatible. */
  readonly retenu: Regime | null;
  /** Les deux régimes du groupe, celui de l'analyse d'abord. */
  readonly regimes: readonly R[];
}

export type RaisonNonReportee = 'credit' | 'autre' | 'sans_bien';

/** Une dépense de l'année que la déclaration au réel ne sait pas placer. */
export interface DepenseNonReportee {
  readonly depense: Depense;
  readonly date: string;
  readonly raison: RaisonNonReportee;
}

export interface Declaration {
  readonly anneeRevenus: number;
  readonly anneeDeclaration: number;
  /** Numéros de cases relus pour cette année de revenus ; sinon « à confirmer ». */
  readonly casesVerifiees: boolean;
  readonly versionRegles: string;
  readonly foncier: GroupeDeclaration<RegimeFoncier> | null;
  readonly meuble: GroupeDeclaration<RegimeMeuble> | null;
  readonly nonReportees: readonly DepenseNonReportee[];
}

const LIGNE_DE_CATEGORIE: Readonly<Record<CategorieDepense, LigneCharges2044 | null>> = {
  credit: null,
  taxe_fonciere: 'taxeFonciere',
  copropriete: 'copropriete',
  assurance: 'assurance',
  travaux: 'travaux',
  entretien: 'travaux',
  gestion: 'fraisGestion',
  autre: null,
};

const REGIMES_FONCIER: readonly Regime[] = ['micro_foncier', 'nu_reel'];
const REGIMES_MEUBLE: readonly Regime[] = ['micro_bic', 'lmnp_reel'];

function enCentimes(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Les paiements encaissés dans l'année (à leur date, comme Argent) pour les locations de ces biens ;
 * la part hors charges suit le loyer et les charges du mois payé.
 */
export function recettesDeLAnnee(
  donnees: Pick<DonneesArgent, 'locations' | 'paiements'>,
  annee: number,
  bienIds: ReadonlySet<string>,
): RecettesAnnee {
  const locations = new Map(donnees.locations.map((l) => [l.id, l]));
  const prefixe = `${String(annee)}-`;
  let loyers = 0;
  let total = 0;
  for (const paiement of donnees.paiements) {
    const location = locations.get(paiement.locationId);
    if (location === undefined || !bienIds.has(location.bienId)) continue;
    if (!paiement.date.startsWith(prefixe)) continue;
    const montants = montantsDuMois(location, paiement.periode);
    const du = montants.loyerHorsCharges + montants.charges;
    loyers +=
      du === 0 ? paiement.montant : Math.round((paiement.montant * montants.loyerHorsCharges) / du);
    total += paiement.montant;
  }
  return { loyers, charges: total - loyers, total };
}

function retenuDuGroupe(biens: readonly BienGere[], compatibles: readonly Regime[]): Regime | null {
  for (const bien of biens) {
    const regime = regimeDeLAnalyse(bien);
    if (regime !== null && compatibles.includes(regime)) return regime;
  }
  return null;
}

function avecLeRetenuDabord<R extends { readonly regime: Regime }>(
  regimes: readonly R[],
  retenu: Regime | null,
): readonly R[] {
  return [...regimes].sort((a, b) => Number(b.regime === retenu) - Number(a.regime === retenu));
}

function abattementMicro(recettes: number, taux: number, minimum: number): number {
  return Math.min(recettes, Math.max(Math.round(recettes * taux), minimum));
}

function loueDansLAnnee(
  donnees: Pick<DonneesArgent, 'locations'>,
  bienId: string,
  annee: number,
): boolean {
  const debut = `${String(annee)}-01-01`;
  const fin = `${String(annee)}-12-31`;
  return donnees.locations.some(
    (l) => l.bienId === bienId && l.debut <= fin && (l.fin === undefined || l.fin >= debut),
  );
}

/** Intérêts et assurance des prêts de ces biens payés dans l'année (ligne 250). */
function interetsDeLAnnee(
  donnees: DonneesArgent,
  annee: number,
  bienIds: ReadonlySet<string>,
): number {
  let total = 0;
  for (const pret of donnees.prets) {
    if (!bienIds.has(pret.bienId)) continue;
    for (let mois = 1; mois <= 12; mois += 1) {
      const echeance = echeanceDuMois(pret, `${String(annee)}-${String(mois).padStart(2, '0')}`);
      if (echeance !== null) total += echeance.interets + echeance.assurance;
    }
  }
  return total;
}

/**
 * Répartition du déficit selon la 2044 (lignes 430 à 442) : si les intérêts dépassent les recettes,
 * seules les autres charges vont au revenu global (dans la limite du plafond) ; sinon tout le déficit,
 * dans la même limite ; le reste s'impute sur les revenus fonciers des années suivantes.
 */
function repartirResultat(
  loyers: number,
  autresCharges: number,
  interets: number,
  plafond: number,
): Pick<ReelFoncier, 'resultat' | 'benefice' | 'deficitRevenuGlobal' | 'deficitRevenusFonciers'> {
  const resultat = loyers - autresCharges - interets;
  if (resultat >= 0) {
    return { resultat, benefice: resultat, deficitRevenuGlobal: 0, deficitRevenusFonciers: 0 };
  }
  if (interets > loyers) {
    const revenuGlobal = Math.min(autresCharges, plafond);
    return {
      resultat,
      benefice: 0,
      deficitRevenuGlobal: revenuGlobal,
      deficitRevenusFonciers: autresCharges - revenuGlobal + (interets - loyers),
    };
  }
  const revenuGlobal = Math.min(-resultat, plafond);
  return {
    resultat,
    benefice: 0,
    deficitRevenuGlobal: revenuGlobal,
    deficitRevenusFonciers: -resultat - revenuGlobal,
  };
}

/** La déclaration des revenus de `annee`, à déposer l'année suivante. */
export function declarationDeLAnnee(
  donnees: DonneesArgent,
  annee: number,
  regles: Regles = obtenirRegles(VERSION_REGLES_COURANTE),
): Declaration {
  const { fiscalite } = regles;
  const biensFoncier = donnees.biens.filter((b) => !b.meuble);
  const biensMeuble = donnees.biens.filter((b) => b.meuble);
  const idsFoncier = new Set(biensFoncier.map((b) => b.id));
  const nonReportees: DepenseNonReportee[] = [];
  const charges: Record<LigneCharges2044, number> = {
    fraisGestion: 0,
    forfaitGestion: 0,
    assurance: 0,
    travaux: 0,
    taxeFonciere: 0,
    copropriete: 0,
  };

  // Les occurrences de l'année, dépenses communes comprises (celles d'un bien supprimé sont écartées).
  for (const { depense, date } of argentDeLAnnee(donnees, annee).occurrences) {
    if (depense.bienId === undefined) {
      nonReportees.push({ depense, date, raison: 'sans_bien' });
      continue;
    }
    // Un bien meublé ne se déclare pas au réel foncier ; une charge récupérable n'est pas déductible.
    if (!idsFoncier.has(depense.bienId) || depense.recuperable) continue;
    const ligne = LIGNE_DE_CATEGORIE[depense.categorie];
    if (ligne === null) {
      nonReportees.push({ depense, date, raison: depense.categorie as 'credit' | 'autre' });
    } else {
      charges[ligne] += depense.montant;
    }
  }

  let foncier: GroupeDeclaration<RegimeFoncier> | null = null;
  if (biensFoncier.length > 0) {
    const recettes = recettesDeLAnnee(donnees, annee, idsFoncier);
    const locaux = biensFoncier.filter((b) => loueDansLAnnee(donnees, b.id, annee)).length;
    charges.forfaitGestion = locaux * FORFAIT_GESTION_PAR_LOCAL;
    const totalCharges = Object.values(charges).reduce((t, m) => t + m, 0);
    const interets = interetsDeLAnnee(donnees, annee, idsFoncier);
    const plafondRevenuGlobal = enCentimes(fiscalite.deficitFoncier.plafondRevenuGlobal);
    const abattement = abattementMicro(recettes.loyers, fiscalite.microFoncier.abattement, 0);
    const plafondMicro = enCentimes(fiscalite.microFoncier.plafond);
    const retenu = retenuDuGroupe(biensFoncier, REGIMES_FONCIER);
    foncier = {
      biens: biensFoncier,
      recettes,
      retenu,
      regimes: avecLeRetenuDabord<RegimeFoncier>(
        [
          {
            regime: 'micro_foncier',
            recettes: recettes.loyers,
            abattementTaux: fiscalite.microFoncier.abattement,
            abattement,
            imposable: recettes.loyers - abattement,
            plafond: plafondMicro,
            depassePlafond: recettes.loyers > plafondMicro,
          },
          {
            regime: 'nu_reel',
            loyers: recettes.loyers,
            charges,
            totalCharges,
            interets,
            ...repartirResultat(recettes.loyers, totalCharges, interets, plafondRevenuGlobal),
            plafondRevenuGlobal,
            locaux,
          },
        ],
        retenu,
      ),
    };
  }

  let meuble: GroupeDeclaration<RegimeMeuble> | null = null;
  if (biensMeuble.length > 0) {
    const recettes = recettesDeLAnnee(donnees, annee, new Set(biensMeuble.map((b) => b.id)));
    const abattement = abattementMicro(
      recettes.total,
      fiscalite.microBic.abattement,
      ABATTEMENT_MINIMUM_MICRO_BIC,
    );
    const plafond = enCentimes(fiscalite.microBic.plafond);
    const retenu = retenuDuGroupe(biensMeuble, REGIMES_MEUBLE);
    meuble = {
      biens: biensMeuble,
      recettes,
      retenu,
      regimes: avecLeRetenuDabord<RegimeMeuble>(
        [
          {
            regime: 'micro_bic',
            recettes: recettes.total,
            abattementTaux: fiscalite.microBic.abattement,
            abattement,
            imposable: recettes.total - abattement,
            plafond,
            depassePlafond: recettes.total > plafond,
          },
          { regime: 'lmnp_reel', recettes: recettes.total },
        ],
        retenu,
      ),
    };
  }

  return {
    anneeRevenus: annee,
    anneeDeclaration: annee + 1,
    casesVerifiees: annee === ANNEE_REVENUS_VERIFIEE,
    versionRegles: regles.version,
    foncier,
    meuble,
    nonReportees,
  };
}
