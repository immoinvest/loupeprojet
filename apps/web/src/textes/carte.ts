import type { ClassePrix, PointCarte, ReperePrixCarte } from '@/enrichissement';
import { dateCourte, euros, nombre } from '@/formatage/nombres';

import { prixM2 } from './adresse';

export const PHRASES_CARTE = {
  titre: 'Les ventes autour du bien',
  chargement: 'Chargement de la carte…',
  bien: 'Le bien',
} as const;

/** « 18 ventes comparables à 300 m au plus, … ». */
export function phraseCarte(nombreVentes: number): string {
  const ventes = nombreVentes > 1 ? 'ventes comparables' : 'vente comparable';
  return `${nombre(nombreVentes)} ${ventes} à 300 m au plus, prix au m² ramenés à aujourd’hui et à la surface du bien. Touchez ou survolez un point pour son détail.`;
}

/** Nom de la carte pour un lecteur d'écran ; les tableaux en dessous donnent le détail. */
export function libelleAccessibleCarte(nombreVentes: number): string {
  return `Carte des ventes comparables autour du bien : ${nombre(nombreVentes)} ${nombreVentes > 1 ? 'points' : 'point'}.`;
}

export interface EntreeLegende {
  readonly classe: ClassePrix;
  readonly libelle: string;
}

export function legendeCarte(repere: ReperePrixCarte | null): readonly EntreeLegende[] {
  if (repere === null) return [{ classe: 'milieu', libelle: 'Ventes comparables' }];
  return [
    { classe: 'bas', libelle: `Moins de ${prixM2(repere.q1M2)}` },
    { classe: 'milieu', libelle: `Entre ${prixM2(repere.q1M2)} et ${prixM2(repere.q3M2)}` },
    { classe: 'haut', libelle: `Plus de ${prixM2(repere.q3M2)}` },
  ];
}

/** « 3 621 €/m² · 58 m² · 210 000 € · 1 mars 2025 · à 40 m ». */
export function libelleVenteCarte(vente: PointCarte): string {
  return `${prixM2(vente.prixM2Corrige)} · ${nombre(vente.surface)} m² · ${euros(vente.prix)} · ${dateCourte(vente.date)} · à ${nombre(vente.distanceMetres)} m`;
}
