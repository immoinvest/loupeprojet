import type { CodeGroupe, VenteSituee } from './analyse';

/** La carte s'arrête au cercle le plus large de l'analyse : au-delà, une vente ne compte dans aucun cercle. */
export const RAYON_CARTE_METRES = 300;
/** Plafond des points renvoyés : un quartier dense compte parfois des centaines de ventes à 300 m. */
export const MAX_VENTES_CARTE = 300;

/** Coordonnées arrondies au millionième de degré, une dizaine de centimètres. */
const PRECISION_COORDONNEES = 1_000_000;

export interface VenteSurCarte {
  readonly lat: number;
  readonly lon: number;
  readonly date: string;
  readonly prix: number;
  readonly surface: number;
  /** Prix au m² actualisé et ramené à la surface du bien, comme dans les statistiques. */
  readonly prixM2Corrige: number;
  readonly distanceMetres: number;
  readonly groupes: readonly CodeGroupe[];
}

function arrondirCoordonnee(valeur: number): number {
  return Math.round(valeur * PRECISION_COORDONNEES) / PRECISION_COORDONNEES;
}

/**
 * Les ventes comparables géolocalisées à 300 m au plus, les plus proches d'abord, plafonnées :
 * ce que la carte du quartier affiche. Pure.
 */
export function ventesSurCarte(
  situees: readonly VenteSituee[],
  estComparable: (s: VenteSituee) => boolean,
): VenteSurCarte[] {
  return situees
    .flatMap((s) => {
      const { position } = s;
      if (position === null || position.distance > RAYON_CARTE_METRES || !estComparable(s)) {
        return [];
      }
      return [
        {
          lat: arrondirCoordonnee(position.point.lat),
          lon: arrondirCoordonnee(position.point.lon),
          date: s.vente.date,
          prix: s.vente.prix,
          surface: s.vente.surface,
          prixM2Corrige: Math.round(s.prixM2Corrige),
          distanceMetres: Math.round(position.distance),
          groupes: s.groupes,
        },
      ];
    })
    .sort((a, b) => a.distanceMetres - b.distanceMetres)
    .slice(0, MAX_VENTES_CARTE);
}
