import {
  montantsDuMois,
  periodeDe,
  resumeDuMois,
  type BienGere,
  type EtatGestion,
  type Locataire,
  type StatutLoyer,
} from '@loupe/gestion';

import { etatDuBien, type EtatDuBien } from './fiche';

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

/** Une ligne de « Mes biens » (ADR-G18 : calculée depuis l'état, sans route dédiée). */
export interface ResumeDuBien {
  readonly bien: BienGere;
  readonly etat: EtatDuBien;
  /** Aucun locataire aujourd'hui, une entrée à venir : les locations comptées sont celles à venir. */
  readonly aVenir: boolean;
  /** Locations comptées : en cours (plusieurs pour une location à la chambre), ou à venir. */
  readonly locations: number;
  /** Leurs locataires, titulaires puis colocataires, sans doublon. */
  readonly locataires: readonly Locataire[];
  /** Somme de leurs loyers charges comprises pour un mois plein, montants en vigueur ce mois-ci. */
  readonly loyerMensuel: number;
  /** Le statut le plus urgent des loyers de ce mois pour ce bien, ou `null` sans loyer dû. */
  readonly statutDuMois: StatutLoyer | null;
}

/** Tous les biens, loués ou non, triés par nom dans l'ordre naturel (« Coloc 2 » avant « Coloc 10 »). */
export function resumeDesBiens(donnees: Donnees, aujourdhui: string): ResumeDuBien[] {
  const periode = periodeDe(aujourdhui);
  // Les lignes du mois sont triées par urgence : la première d'un bien donne son statut.
  const { lignes } = resumeDuMois(donnees, periode, aujourdhui);
  return donnees.biens
    .map((bien) => {
      const etat = etatDuBien(donnees, bien.id, aujourdhui);
      const aVenir = etat.statut === 'a_venir';
      const comptees = aVenir
        ? etat.locations
        : etat.locations.filter((l) => l.debut <= aujourdhui);
      const ids = [...new Set(comptees.flatMap((l) => [l.locataireId, ...l.colocataireIds]))];
      return {
        bien,
        etat,
        aVenir,
        locations: comptees.length,
        locataires: ids.flatMap((id) => donnees.locataires.filter((l) => l.id === id)),
        loyerMensuel: comptees
          .map((l) => montantsDuMois(l, periode))
          .reduce((somme, m) => somme + m.loyerHorsCharges + m.charges, 0),
        statutDuMois: lignes.find((ligne) => ligne.location.bienId === bien.id)?.statut ?? null,
      };
    })
    .sort((a, b) => a.bien.nom.localeCompare(b.bien.nom, 'fr', { numeric: true }));
}
