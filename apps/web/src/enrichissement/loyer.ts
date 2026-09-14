import { obtenirRegles, type ModeLocation, type Projet } from '@loupe/moteur';

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

/** Le loyer mensuel visé selon le type : nu en location nue, meublé pour tous les autres. */
export function loyerVise(loyer: LoyerBien, mode: ModeLocation): number {
  return mode === 'nu' ? loyer.nuMensuel : loyer.meubleMensuel;
}

/** Loyer visé déduit du loyer de référence hors charges (€/m² par mois) : nu en location nue, meublé sinon. */
export function loyerViseDepuisReference(
  referenceM2: number,
  surface: number,
  mode: ModeLocation,
  primeMeuble: number,
): number {
  const nu = referenceM2 * surface;
  return Math.round(mode === 'nu' ? nu : nu * (1 + primeMeuble));
}

/** En colocation, le loyer meublé du logement majoré de la prime colocation, réparti entre les chambres. */
export function loyerParChambre(
  loyer: LoyerBien,
  chambres: number,
  primeColocation: number,
): number {
  return Math.round((loyer.meubleMensuel * (1 + primeColocation)) / Math.max(1, chambres));
}

/**
 * Le loyer de marché d'un projet (référence ANIL de la commune, posée à la création), dans l'unité du
 * champ qui manque : loyer mensuel en nue, meublée et moyenne durée, loyer par chambre en colocation.
 * `null` sans référence, et en courte durée (une nuitée ne se déduit pas d'un loyer de marché).
 */
export function loyerDeReference(projet: Projet): number | null {
  const reference = projet.marche.loyerReferenceM2;
  const { location } = projet.hypotheses;
  if (reference === undefined || location.mode === 'courte_duree') return null;
  const { primeMeuble, primeColocation } = obtenirRegles(projet.versionRegles).exploitation;
  if (location.mode === 'colocation') {
    const meuble = reference * projet.bien.surface * (1 + primeMeuble);
    return Math.round((meuble * (1 + primeColocation)) / Math.max(1, location.chambres));
  }
  return loyerViseDepuisReference(reference, projet.bien.surface, location.mode, primeMeuble);
}

/** Un loyer de marché devient le loyer du projet (le champ du type), provenance « anil ». */
export function appliquerLoyerDeReference(projet: Projet, loyer: number): Projet {
  const { location } = projet.hypotheses;
  if (location.mode === 'courte_duree') return projet;
  const colocation = location.mode === 'colocation';
  return {
    ...projet,
    hypotheses: {
      ...projet.hypotheses,
      location: colocation ? { ...location, loyerChambre: loyer } : { ...location, loyerHc: loyer },
    },
    provenance: {
      ...projet.provenance,
      [colocation ? 'location.loyerChambre' : 'location.loyerHc']: 'anil',
    },
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

/**
 * Le loyer de marché devient le loyer visé du projet, provenance « anil » : loyer mensuel en nue,
 * meublée et moyenne durée, loyer par chambre en colocation ; rien en courte durée (pas de loyer mensuel).
 */
export function appliquerLoyerVise(projet: Projet, loyer: LoyerBien): Projet {
  const { location } = projet.hypotheses;
  if (location.mode === 'courte_duree') return projet;
  const { primeColocation } = obtenirRegles(projet.versionRegles).exploitation;
  const suivante =
    location.mode === 'colocation'
      ? { ...location, loyerChambre: loyerParChambre(loyer, location.chambres, primeColocation) }
      : { ...location, loyerHc: loyerVise(loyer, location.mode) };
  const cle = location.mode === 'colocation' ? 'location.loyerChambre' : 'location.loyerHc';
  return {
    ...projet,
    hypotheses: { ...projet.hypotheses, location: suivante },
    provenance: { ...projet.provenance, [cle]: 'anil' },
  };
}
