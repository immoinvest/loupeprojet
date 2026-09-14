import { prixRetenu } from '../achat';
import { arrondirEuro, arrondirTaux } from '../commun/arrondi';
import type { NiveauConfiance, Regles } from '../regles/types';
import type { Bien, EtatBien } from '../schema/bien';
import type { CodeCorrection } from '../schema/estimation';
import type { Dvf } from '../schema/marche';
import type { Projet } from '../schema/projet';

export type { NiveauConfiance } from '../regles/types';

export const ETATS: readonly EtatBien[] = ['a_renover', 'a_rafraichir', 'bon_etat', 'renove'];

export interface Correction {
  readonly code: CodeCorrection;
  /** Effet sur le prix, en proportion du prix de marché à l'état retenu. */
  readonly taux: number;
  readonly montant: number;
  /** Désactivée pour ce projet : listée, sans effet sur l'estimation. */
  readonly ignoree: boolean;
}

export interface ChargesComparees {
  readonly repereAnnuel: number;
  /** Charges annuelles du bien moins le repère : positif = plus chères que la moyenne. */
  readonly excedentAnnuel: number;
  /** Rendement locatif brut local qui capitalise l'écart. */
  readonly rendementLocal: number;
  readonly borneAtteinte: boolean;
}

export interface EstimationPrix {
  readonly etat: EtatBien;
  /** Vrai quand l'état n'est pas renseigné : « bon état » est supposé. */
  readonly etatSuppose: boolean;
  /** Prix au m² des ventes comparables à la position de l'état, avant corrections. */
  readonly prixM2Marche: number;
  readonly corrections: readonly Correction[];
  readonly prixM2Estime: number;
  readonly centre: number;
  readonly bas: number;
  readonly haut: number;
  /** Le même bien, corrections comprises, selon chacun des quatre états. */
  readonly selonEtat: Readonly<Record<EtatBien, number>>;
  readonly confiance: NiveauConfiance;
  readonly marge: number;
  readonly charges: ChargesComparees | null;
  readonly actualiseAu: string | null;
  /** Prix retenu (négocié) ÷ estimation − 1 : négatif = sous l'estimation. */
  readonly ecartPrix: number;
}

/** Prix au m² à un quantile, par interpolation entre premier quartile, médiane et troisième quartile. */
export function prixSelonPosition(dvf: Dvf, position: number): number {
  const q1 = dvf.q1M2 ?? dvf.medianM2;
  const q3 = dvf.q3M2 ?? dvf.medianM2;
  if (position <= 0.5) return q1 + (dvf.medianM2 - q1) * ((position - 0.25) / 0.25);
  return dvf.medianM2 + (q3 - dvf.medianM2) * ((position - 0.5) / 0.25);
}

export function tauxDpe(bien: Bien, regles: Regles): number | null {
  return bien.dpe === undefined ? null : regles.estimation.dpe[bien.type][bien.dpe];
}

/** Maisons et étage inconnu : rien. Rez-de-chaussée : décote. Étages hauts : selon l'ascenseur, s'il est connu. */
export function tauxEtage(bien: Bien, regles: Regles): number | null {
  if (bien.type === 'maison' || bien.etage === undefined) return null;
  const { avecAscenseur, sansAscenseur } = regles.estimation.etage;
  if (bien.etage <= 0) {
    return bien.ascenseur === true ? avecAscenseur.rezDeChaussee : sansAscenseur.rezDeChaussee;
  }
  if (bien.ascenseur === undefined) return null;
  const effet = bien.ascenseur ? avecAscenseur : sansAscenseur;
  return bien.etage >= effet.hautsAPartirDe ? effet.hauts : null;
}

export function tauxExterieur(bien: Bien, regles: Regles): number | null {
  return bien.exterieur === true ? regles.estimation.exterieur : null;
}

export function niveauConfiance(dvf: Dvf, regles: Regles): NiveauConfiance {
  const c = regles.estimation.confiance;
  const rayon = dvf.rayonMetres ?? Number.POSITIVE_INFINITY;
  if (rayon <= c.eleveeRayonMetres && dvf.nombreVentes >= c.eleveeVentes) return 'elevee';
  if (rayon <= c.moyenneRayonMetres && dvf.nombreVentes >= c.moyenneVentes) return 'moyenne';
  return 'faible';
}

interface EffetCharges extends ChargesComparees {
  readonly montant: number;
}

/**
 * Un excédent de charges est un coût annuel permanent pour l'acheteur : capitalisé au rendement brut local
 * (loyer de référence ANIL ÷ prix médian, sinon loyer ÷ prix du projet), borné. Charges nulles ou estimées : rien.
 */
export function effetCharges(
  projet: Projet,
  dvf: Dvf,
  regles: Regles,
  valeurAvantCharges: number,
): EffetCharges | null {
  const { coproAnnuel } = projet.hypotheses.charges;
  if (coproAnnuel === 0 || projet.provenance['charges.coproAnnuel'] === 'estime') return null;
  const { loyerReferenceM2 } = projet.marche;
  const rendementLocal =
    loyerReferenceM2 === undefined
      ? (projet.hypotheses.location.loyerHc * 12) / prixRetenu(projet.hypotheses.achat)
      : (loyerReferenceM2 * 12) / dvf.medianM2;
  if (rendementLocal <= 0) return null;
  const repereAnnuel = regles.estimation.charges.repereM2An * projet.bien.surface;
  const excedentAnnuel = coproAnnuel - repereAnnuel;
  const brut = -excedentAnnuel / rendementLocal;
  const borne = regles.estimation.charges.borne * valeurAvantCharges;
  const montant = Math.max(-borne, Math.min(borne, brut));
  return {
    repereAnnuel,
    excedentAnnuel,
    rendementLocal,
    borneAtteinte: Math.abs(brut) > borne,
    montant,
  };
}

/**
 * Estimation du prix du bien à partir des ventes comparables (DVF, actualisées quand elles l'ont été) :
 * position selon l'état, corrections sourcées additionnées, charges capitalisées, fourchette selon la confiance.
 * `null` sans données de ventes. Pure.
 */
export function estimerPrix(projet: Projet, regles: Regles): EstimationPrix | null {
  const { dvf } = projet.marche;
  if (dvf === undefined) return null;
  const { bien } = projet;
  const ignorees = new Set(projet.estimation.correctionsIgnorees);
  const etat = bien.etat ?? 'bon_etat';
  const prixM2Marche = prixSelonPosition(dvf, regles.estimation.positionsEtat[etat]);
  const valeurMarche = prixM2Marche * bien.surface;

  const candidates: readonly (readonly [CodeCorrection, number | null])[] = [
    ['dpe', tauxDpe(bien, regles)],
    ['etage', tauxEtage(bien, regles)],
    ['exterieur', tauxExterieur(bien, regles)],
  ];
  const proportionnelles = candidates.flatMap(([code, taux]) =>
    taux === null || taux === 0 ? [] : [{ code, taux, ignoree: ignorees.has(code) }],
  );
  const sommeTaux = proportionnelles.reduce((s, c) => (c.ignoree ? s : s + c.taux), 0);
  const charges = effetCharges(projet, dvf, regles, valeurMarche * (1 + sommeTaux));
  const chargesIgnorees = ignorees.has('charges');
  const montantCharges = charges === null || chargesIgnorees ? 0 : charges.montant;

  const corrections: Correction[] = proportionnelles.map((c) => ({
    code: c.code,
    taux: arrondirTaux(c.taux),
    montant: arrondirEuro(valeurMarche * c.taux),
    ignoree: c.ignoree,
  }));
  if (charges !== null) {
    corrections.push({
      code: 'charges',
      taux: arrondirTaux(charges.montant / valeurMarche),
      montant: arrondirEuro(charges.montant),
      ignoree: chargesIgnorees,
    });
  }

  const valeur = (e: EtatBien): number =>
    prixSelonPosition(dvf, regles.estimation.positionsEtat[e]) * bien.surface * (1 + sommeTaux) +
    montantCharges;
  const centre = valeur(etat);
  const confiance = niveauConfiance(dvf, regles);
  const marge = regles.estimation.marges[confiance];
  return {
    etat,
    etatSuppose: bien.etat === undefined,
    prixM2Marche: arrondirEuro(prixM2Marche),
    corrections,
    prixM2Estime: arrondirEuro(centre / bien.surface),
    centre: arrondirEuro(centre),
    bas: arrondirEuro(centre * (1 - marge)),
    haut: arrondirEuro(centre * (1 + marge)),
    selonEtat: {
      a_renover: arrondirEuro(valeur('a_renover')),
      a_rafraichir: arrondirEuro(valeur('a_rafraichir')),
      bon_etat: arrondirEuro(valeur('bon_etat')),
      renove: arrondirEuro(valeur('renove')),
    },
    confiance,
    marge,
    charges:
      charges === null
        ? null
        : {
            repereAnnuel: arrondirEuro(charges.repereAnnuel),
            excedentAnnuel: arrondirEuro(charges.excedentAnnuel),
            rendementLocal: arrondirTaux(charges.rendementLocal),
            borneAtteinte: charges.borneAtteinte,
          },
    actualiseAu: dvf.actualiseAu ?? null,
    ecartPrix: arrondirTaux(prixRetenu(projet.hypotheses.achat) / centre - 1),
  };
}
