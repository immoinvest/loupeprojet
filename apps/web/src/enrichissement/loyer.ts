import type { ModeLocation, Projet } from '@loupe/moteur';

import type { ReponseMarche } from './contrat';
import { PART_CHARGES_LOYER } from './marche';

export interface LoyerBien {
  /** Loyer de référence hors charges, en € par m² et par mois. */
  readonly referenceM2: number;
  readonly nuMensuel: number;
  readonly meubleMensuel: number;
  /** Fourchette ANIL, en location nue, hors charges. */
  readonly basMensuel: number;
  readonly hautMensuel: number;
}

type LoyerAnil = NonNullable<ReponseMarche['loyer']>;

/**
 * Loyer d'annonce ANIL (charges comprises, location nue) → loyer hors charges du bien : − 8 % de charges,
 * × surface ; en meublé, + la prime meublé des règles.
 */
export function loyerPourBien(loyer: LoyerAnil, surface: number, primeMeuble: number): LoyerBien {
  const horsCharges = (m2: number): number => m2 * (1 - PART_CHARGES_LOYER);
  const nu = horsCharges(loyer.loyerM2) * surface;
  return {
    referenceM2: Math.round(horsCharges(loyer.loyerM2) * 100) / 100,
    nuMensuel: Math.round(nu),
    meubleMensuel: Math.round(nu * (1 + primeMeuble)),
    basMensuel: Math.round(horsCharges(loyer.basM2) * surface),
    hautMensuel: Math.round(horsCharges(loyer.hautM2) * surface),
  };
}

/** Le loyer visé selon le mode : nu en location nue, meublé sinon (courte durée comprise, en équivalent mensuel). */
export function loyerVise(loyer: LoyerBien, mode: ModeLocation): number {
  return mode === 'nu' ? loyer.nuMensuel : loyer.meubleMensuel;
}

/** Loyer visé déduit du loyer de référence hors charges (€/m² par mois) rangé dans le projet. */
export function loyerViseDepuisReference(
  referenceM2: number,
  surface: number,
  mode: ModeLocation,
  primeMeuble: number,
): number {
  const nu = referenceM2 * surface;
  return Math.round(mode === 'nu' ? nu : nu * (1 + primeMeuble));
}

/** Le loyer de marché d'un projet (référence ANIL de la commune, posée à la création) ; `null` sans référence. */
export function loyerDeReference(projet: Projet, primeMeuble: number): number | null {
  const reference = projet.marche.loyerReferenceM2;
  if (reference === undefined) return null;
  return loyerViseDepuisReference(
    reference,
    projet.bien.surface,
    projet.hypotheses.location.mode,
    primeMeuble,
  );
}

/** Un loyer de marché devient le loyer visé du projet, provenance « anil ». */
export function appliquerLoyerDeReference(projet: Projet, loyer: number): Projet {
  return {
    ...projet,
    hypotheses: {
      ...projet.hypotheses,
      location: { ...projet.hypotheses.location, loyerHc: loyer },
    },
    provenance: { ...projet.provenance, 'location.loyerHc': 'anil' },
  };
}

/** Loyer de référence du marché dans le projet, provenance « anil ». */
export function appliquerLoyerReference(projet: Projet, loyer: LoyerBien): Projet {
  return {
    ...projet,
    marche: { ...projet.marche, loyerReferenceM2: loyer.referenceM2 },
    provenance: { ...projet.provenance, 'marche.loyerReferenceM2': 'anil' },
  };
}

/** Le loyer de marché devient le loyer visé du projet, provenance « anil ». */
export function appliquerLoyerVise(projet: Projet, loyer: LoyerBien): Projet {
  return {
    ...projet,
    hypotheses: {
      ...projet.hypotheses,
      location: {
        ...projet.hypotheses.location,
        loyerHc: loyerVise(loyer, projet.hypotheses.location.mode),
      },
    },
    provenance: { ...projet.provenance, 'location.loyerHc': 'anil' },
  };
}
