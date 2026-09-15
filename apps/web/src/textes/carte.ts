import type {
  ClassePrix,
  FondCarte,
  ModeCouleur,
  NiveauPoint,
  PointCarte,
  RayonCarte,
  ReperePrixCarte,
} from '@/enrichissement';
import { dateCourte, euros, nombre } from '@/formatage/nombres';

import { LIBELLES_GROUPES, prixM2 } from './adresse';
import { phraseAnnexes, phraseSurfaces } from './ventes';

export const PHRASES_CARTE = {
  titre: 'Les ventes autour du bien',
  chargement: 'Chargement de la carte…',
  bien: 'Le bien',
  couleur: 'Couleur des ventes',
  fond: 'Fond de carte',
  parcelles: 'Parcelles cadastrales',
  recentrer: 'Recentrer sur le bien',
  pleinEcran: 'Plein écran',
  fermer: 'Fermer la carte',
  voirTableau: 'Voir dans le tableau',
  voirCarte: 'Sur la carte',
  fermerBulle: 'Fermer la fiche de la vente',
  zoomer: 'Zoomer',
  dezoomer: 'Dézoomer',
} as const;

export const LIBELLES_MODES: Readonly<Record<ModeCouleur, string>> = {
  prix: 'Prix au m²',
  anciennete: 'Ancienneté',
  dpe: 'DPE',
};

export const LIBELLES_FONDS: Readonly<Record<FondCarte, string>> = {
  plan: 'Plan IGN',
  photo: 'Photo aérienne',
};

export const MESSAGES_GESTES = {
  ctrl: 'Ctrl + molette pour zoomer',
  doigts: 'Utilisez deux doigts pour déplacer la carte',
} as const;

/** « 18 ventes comparables à 300 m au plus, … ». */
export function phraseCarte(nombreVentes: number): string {
  const ventes = nombreVentes > 1 ? 'ventes comparables' : 'vente comparable';
  return `${nombre(nombreVentes)} ${ventes} à 300 m au plus, prix au m² ramenés à aujourd’hui et à la surface du bien. Touchez une vente pour sa fiche, un cercle pour filtrer le tableau.`;
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

export interface EntreeLegendeCouleur {
  readonly niveau: NiveauPoint;
  readonly libelle: string;
}

/** La légende des pastilles selon ce que disent les couleurs. */
export function legendeCouleurs(
  mode: ModeCouleur,
  repere: ReperePrixCarte | null,
): readonly EntreeLegendeCouleur[] {
  switch (mode) {
    case 'prix':
      return legendeCarte(repere).map((e) => ({ niveau: e.classe, libelle: e.libelle }));
    case 'anciennete':
      return [
        { niveau: 'bas', libelle: 'Moins d’un an' },
        { niveau: 'milieu', libelle: '1 à 3 ans' },
        { niveau: 'haut', libelle: 'Plus de 3 ans' },
      ];
    case 'dpe':
      return [
        { niveau: 'bas', libelle: 'DPE A à C' },
        { niveau: 'milieu', libelle: 'DPE D ou E' },
        { niveau: 'haut', libelle: 'DPE F ou G' },
        { niveau: 'inconnu', libelle: 'DPE inconnu' },
      ];
  }
}

/** « 3 621 €/m² · 58 m² · 210 000 € · 1 mars 2025 · à 40 m ». */
export function libelleVenteCarte(vente: PointCarte): string {
  return `${prixM2(vente.prixM2Corrige)} · ${nombre(vente.surface)} m² · ${euros(vente.prix)} · ${dateCourte(vente.date)} · à ${nombre(vente.distanceMetres)} m`;
}

/** « 4 ventes à cette adresse » : pastille regroupée. */
export function libelleGroupe(n: number): string {
  return `${nombre(n)} ventes à cette adresse`;
}

/** Info-bulle et nom d'un cercle cliquable. */
export function libelleCercle(rayon: RayonCarte, actif: boolean): string {
  return actif
    ? `Retirer le filtre à moins de ${nombre(rayon)} m`
    : `Filtrer le tableau à moins de ${nombre(rayon)} m`;
}

export interface LigneFiche {
  readonly libelle: string;
  readonly valeur: string;
}

export interface FicheVente {
  readonly titre: string;
  readonly lignes: readonly LigneFiche[];
}

/**
 * La fiche d'une vente dans sa bulle : seulement les lignes connues, jamais de case vide. Les détails (Carrez, pièces,
 * DPE, dépendances) viennent de la ligne du tableau quand la vente y figure.
 */
export function ficheVente(point: PointCarte): FicheVente {
  const { vente } = point;
  const lignes: LigneFiche[] = [
    { libelle: 'Prix', valeur: euros(point.prix) },
    {
      libelle: 'Surface',
      valeur: vente === null ? `${nombre(point.surface)} m²` : phraseSurfaces(vente),
    },
  ];
  if (vente !== null) {
    lignes.push({ libelle: 'Prix au m²', valeur: `${prixM2(vente.prixM2)} à la signature` });
  }
  lignes.push(
    { libelle: 'Au prix d’aujourd’hui', valeur: prixM2(point.prixM2Corrige) },
    { libelle: 'Distance', valeur: `${nombre(point.distanceMetres)} m du bien` },
  );
  const place = point.groupes
    .filter((code) => !code.startsWith('rayon_'))
    .map((code) => LIBELLES_GROUPES[code]);
  if (place.length > 0) lignes.push({ libelle: 'Place', valeur: place.join(' · ') });
  if (vente?.dpe != null) {
    const ges = vente.dpe.etiquetteGes === null ? '' : `, GES ${vente.dpe.etiquetteGes}`;
    lignes.push({ libelle: 'DPE probable', valeur: `DPE ${vente.dpe.etiquetteDpe}${ges}` });
  }
  const annexes = vente === null ? null : phraseAnnexes(vente);
  if (annexes !== null) lignes.push({ libelle: 'Vendu avec', valeur: annexes });
  return { titre: `Vente du ${dateCourte(point.date)}`, lignes };
}
