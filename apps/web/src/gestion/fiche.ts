import {
  periodeDe,
  periodePrecedente,
  resumeDuMois,
  type EtatGestion,
  type LigneLoyer,
  type LocationGeree,
  type StatutLoyer,
} from '@loupe/gestion';

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

/**
 * Où en est un bien aujourd'hui. Les locations sont celles en cours puis à venir, par date d'entrée :
 * plusieurs pour une location à la chambre.
 */
export type EtatDuBien =
  | { readonly statut: 'loue'; readonly locations: readonly LocationGeree[] }
  | { readonly statut: 'vacant'; readonly locations: readonly LocationGeree[] }
  /** Toutes les locations en cours ont une sortie, aucune ne prend le relais : `date` est la dernière. */
  | {
      readonly statut: 'depart_prevu';
      readonly date: string;
      readonly locations: readonly LocationGeree[];
    }
  /** Aucun locataire aujourd'hui, une entrée à venir : `date` est la première. */
  | {
      readonly statut: 'a_venir';
      readonly date: string;
      readonly locations: readonly LocationGeree[];
    };

export type StatutBien = EtatDuBien['statut'];

export function etatDuBien(donnees: Donnees, bienId: string, aujourdhui: string): EtatDuBien {
  const locations = donnees.locations
    .filter((l) => l.bienId === bienId && (l.fin === undefined || l.fin >= aujourdhui))
    .sort((a, b) => a.debut.localeCompare(b.debut));
  const [premiere] = locations;
  if (premiere === undefined) return { statut: 'vacant', locations };
  const enCours = locations.filter((l) => l.debut <= aujourdhui);
  if (enCours.length === 0) return { statut: 'a_venir', date: premiere.debut, locations };
  const sorties = enCours.flatMap((l) => (l.fin === undefined ? [] : [l.fin]));
  if (enCours.length === locations.length && sorties.length === enCours.length) {
    const date = sorties.reduce((derniere, fin) => (fin > derniere ? fin : derniere));
    return { statut: 'depart_prevu', date, locations };
  }
  return { statut: 'loue', locations };
}

export const MOIS_DE_LA_FRISE = 12;

export interface MoisDuBien {
  readonly periode: string;
  /** Le statut le plus urgent des loyers du mois (en retard d'abord), ou `vacant` sans loyer dû. */
  readonly statut: StatutLoyer | 'vacant';
  readonly lignes: readonly LigneLoyer[];
}

/** Les douze derniers mois du bien, du plus ancien au mois en cours. */
export function friseDuBien(
  donnees: Donnees,
  bienId: string,
  aujourdhui: string,
): readonly MoisDuBien[] {
  const duBien = { ...donnees, locations: donnees.locations.filter((l) => l.bienId === bienId) };
  const frise: MoisDuBien[] = [];
  let periode = periodeDe(aujourdhui);
  for (let i = 0; i < MOIS_DE_LA_FRISE; i += 1) {
    // Les lignes sont triées par urgence : la première donne le statut du mois.
    const { lignes } = resumeDuMois(duBien, periode, aujourdhui);
    const [plusUrgente] = lignes;
    frise.unshift({
      periode,
      statut: plusUrgente === undefined ? 'vacant' : plusUrgente.statut,
      lignes,
    });
    periode = periodePrecedente(periode);
  }
  return frise;
}
