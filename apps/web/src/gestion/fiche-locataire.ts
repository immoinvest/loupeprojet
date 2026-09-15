import {
  montantsDuMois,
  periodeDe,
  type BienGere,
  type EtatGestion,
  type Locataire,
  type LocationGeree,
} from '@loupe/gestion';

import { friseDesLocations, type MoisDuBien } from './fiche';

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

export type EtatOccupation = 'en_cours' | 'a_venir' | 'terminee';

/** Une location du locataire, en titre ou en colocation. */
export interface OccupationFiche {
  readonly location: LocationGeree;
  readonly bien: BienGere;
  readonly etat: EtatOccupation;
  /** Ceux de ce mois-ci ; du mois d'entrée pour une location à venir ; du dernier mois pour une location terminée. */
  readonly montants: ReturnType<typeof montantsDuMois>;
  /** Les autres personnes du bail : le titulaire et les colocataires, sauf ce locataire. */
  readonly colocataires: readonly Locataire[];
}

/** La fiche d'un locataire (ADR-G23 : calculée depuis l'état, sans route dédiée). */
export interface FicheLocataire {
  readonly locataire: Locataire;
  /** En cours et à venir d'abord, puis terminées ; les plus récentes d'abord. */
  readonly occupations: readonly OccupationFiche[];
  /** Ses loyers des douze derniers mois : seulement les mois où il devait un loyer. */
  readonly loyers: readonly MoisDuBien[];
}

/** L'état de la location et le mois dont on montre les montants. */
function etatDe(
  location: LocationGeree,
  aujourdhui: string,
): { readonly etat: EtatOccupation; readonly periode: string } {
  if (location.fin !== undefined && location.fin < aujourdhui) {
    return { etat: 'terminee', periode: periodeDe(location.fin) };
  }
  if (location.debut > aujourdhui) return { etat: 'a_venir', periode: periodeDe(location.debut) };
  return { etat: 'en_cours', periode: periodeDe(aujourdhui) };
}

export function ficheDuLocataire(
  donnees: Donnees,
  locataireId: string,
  aujourdhui: string,
): FicheLocataire | null {
  const locataire = donnees.locataires.find((l) => l.id === locataireId);
  if (locataire === undefined) return null;
  const locations = donnees.locations.filter(
    (l) => l.locataireId === locataireId || l.colocataireIds.includes(locataireId),
  );
  const occupations = locations
    .flatMap((location): OccupationFiche[] => {
      // Un bien absent (données incohérentes) : la location n'a pas de carte.
      const bien = donnees.biens.find((b) => b.id === location.bienId);
      if (bien === undefined) return [];
      const { etat, periode } = etatDe(location, aujourdhui);
      const autres = [location.locataireId, ...location.colocataireIds].filter(
        (id) => id !== locataireId,
      );
      return [
        {
          location,
          bien,
          etat,
          montants: montantsDuMois(location, periode),
          colocataires: autres.flatMap((id) => donnees.locataires.filter((l) => l.id === id)),
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(a.etat === 'terminee') - Number(b.etat === 'terminee') ||
        b.location.debut.localeCompare(a.location.debut),
    );
  return {
    locataire,
    occupations,
    loyers: friseDesLocations(donnees, locations, aujourdhui).filter((m) => m.statut !== 'vacant'),
  };
}
