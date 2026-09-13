import { baseFraisAcquisition } from '../financement/frais-acquisition';
import type { Regles } from '../regles/types';
import type { Projet } from '../schema/projet';

export interface DotationsAnnee {
  readonly annee: number;
  /** Bâti (par composants) + travaux : réintégrés à la plus-value en LMNP réel. */
  readonly immeuble: number;
  /** Mobilier : hors champ de la réintégration. */
  readonly mobilier: number;
}

/** Valeur du bâti amortissable : prix hors honoraires acquéreur, hors terrain. */
export function baseAmortissableBati(projet: Projet, regles: Regles): number {
  return (
    baseFraisAcquisition(projet.hypotheses.achat) * (1 - regles.fiscalite.amortissement.partTerrain)
  );
}

function dotationLineaire(montant: number, dureeAnnees: number, annee: number): number {
  return annee <= dureeAnnees ? montant / dureeAnnees : 0;
}

/** Dotations de l'année (linéaires par composant, simplification ADR-M4). */
export function dotationsAnnee(projet: Projet, regles: Regles, annee: number): DotationsAnnee {
  const { amortissement } = regles.fiscalite;
  const { travaux, mobilier } = projet.hypotheses.achat;
  const bati = baseAmortissableBati(projet, regles);
  const dotationBati = amortissement.composants.reduce(
    (acc, c) => acc + dotationLineaire(bati * c.part, c.dureeAnnees, annee),
    0,
  );
  return {
    annee,
    immeuble: dotationBati + dotationLineaire(travaux, amortissement.travauxDureeAnnees, annee),
    mobilier: dotationLineaire(mobilier, amortissement.mobilierDureeAnnees, annee),
  };
}
