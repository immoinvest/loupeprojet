import { dotationsAnnee } from './amortissements';
import { construireAnnee, finaliserRegime } from './commun-regime';
import {
  STOCK_VIDE,
  ajouterDeficit,
  imputerDeficits,
  totalDeficits,
  type StockDeficits,
} from './deficits';
import { assuranceAnnee, interetsPayesAnnee } from './interets';
import type { AnneeFiscale, ContexteFiscal, ProjectionRegime } from './types';

interface EtatLmnp {
  readonly deficits: StockDeficits;
  readonly amortImmeubleDispo: number;
  readonly amortMobilierDispo: number;
  readonly immeubleDeduitCumul: number;
}

const ETAT_INITIAL: EtatLmnp = {
  deficits: STOCK_VIDE,
  amortImmeubleDispo: 0,
  amortMobilierDispo: 0,
  immeubleDeduitCumul: 0,
};

/** Frais passés en charge la première année : notaire, honoraires acquéreur, frais bancaires (ADR-M4). */
export function fraisDeductiblesAnnee1(ctx: ContexteFiscal): number {
  const { achat, pret } = ctx.projet.hypotheses;
  const honoraires = achat.honorairesChargeAcquereur ? achat.honorairesAgence : 0;
  return (
    ctx.financement.fraisAcquisition.total + honoraires + pret.fraisDossier + pret.fraisGarantie
  );
}

/**
 * Art. 39 C II : l'amortissement ne peut ni créer ni augmenter un déficit ; son excédent se reporte sans
 * limite. Sur un résultat positif, on déduit d'abord les amortissements disponibles (année + reports),
 * répartis au prorata immeuble / mobilier, puis les déficits antérieurs (10 ans, CGI 156 I 1° ter) sur
 * le bénéfice qui reste : CE, 15 avril 2015, un déficit ne s'impute que sur le bénéfice établi après
 * tous les amortissements.
 */
function anneeLmnp(
  ctx: ContexteFiscal,
  etat: EtatLmnp,
  annee: number,
  avantImpot: number,
  recettes: number,
  chargesExploitation: number,
): { etat: EtatLmnp; resultat: AnneeFiscale } {
  const { regles, projet, financement } = ctx;
  const { tmi, psBic } = projet.hypotheses.fiscalite;
  const dotations = dotationsAnnee(projet, regles, annee);
  const interets = interetsPayesAnnee(financement, annee);
  const charges =
    chargesExploitation +
    assuranceAnnee(financement, annee) +
    (annee === 1 ? fraisDeductiblesAnnee1(ctx) : 0);
  const resultatAvantAmortissement = recettes - charges - interets;

  let deficits = etat.deficits;
  let amortImmeubleDispo = etat.amortImmeubleDispo + dotations.immeuble;
  let amortMobilierDispo = etat.amortMobilierDispo + dotations.mobilier;
  let deficitImpute = 0;
  let amortissementsDeduits = 0;
  let baseImposable = 0;
  let immeubleDeduit = 0;

  if (resultatAvantAmortissement < 0) {
    deficits = ajouterDeficit(
      deficits,
      -resultatAvantAmortissement,
      annee,
      regles.fiscalite.deficitBic.reportAnnees,
    );
  } else {
    const dispo = amortImmeubleDispo + amortMobilierDispo;
    amortissementsDeduits = Math.min(dispo, resultatAvantAmortissement);
    immeubleDeduit = dispo > 0 ? (amortissementsDeduits * amortImmeubleDispo) / dispo : 0;
    amortImmeubleDispo -= immeubleDeduit;
    amortMobilierDispo -= amortissementsDeduits - immeubleDeduit;
    const benefice = resultatAvantAmortissement - amortissementsDeduits;
    const imputation = imputerDeficits(deficits, benefice, annee);
    deficits = imputation.stock;
    deficitImpute = imputation.impute;
    baseImposable = benefice - deficitImpute;
  }

  return {
    etat: {
      deficits,
      amortImmeubleDispo,
      amortMobilierDispo,
      immeubleDeduitCumul: etat.immeubleDeduitCumul + immeubleDeduit,
    },
    resultat: construireAnnee({
      annee,
      recettes,
      chargesDeductibles: charges,
      interetsDeductibles: interets,
      amortissementsDeduits,
      deficitImpute,
      deficitImputeRevenuGlobal: 0,
      baseImposable,
      impotRevenu: baseImposable * tmi,
      prelevementsSociaux: baseImposable * psBic,
      avantImpot,
      stocks: {
        deficitReportable: totalDeficits(deficits),
        amortissementsReportes: amortImmeubleDispo + amortMobilierDispo,
      },
    }),
  };
}

export function projeterLmnpReel(ctx: ContexteFiscal): ProjectionRegime {
  let etat = ETAT_INITIAL;
  const annees: AnneeFiscale[] = [];
  for (const a of ctx.cashflow.parAnnee) {
    const pas = anneeLmnp(ctx, etat, a.annee, a.avantImpot, a.recettes, a.charges);
    etat = pas.etat;
    annees.push(pas.resultat);
  }
  return finaliserRegime('lmnp_reel', ctx, annees, {
    eligible: true,
    amortissementsImmeubleDeduits: etat.immeubleDeduitCumul,
  });
}
