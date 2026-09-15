import type { EtatGestion, LocationGeree } from '@loupe/gestion';

import { etatDuBien, type EtatDuBien } from './fiche';
import { saisieLouer, type SaisieLouer } from './saisie-louer';

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations' | 'paiements'>;

/** Un bien de la liste « Bien » du formulaire « Nouveau locataire ». */
export interface BienAChoisir {
  readonly id: string;
  readonly nom: string;
  readonly etat: EtatDuBien;
}

/** Les deux groupes de la liste, chacun trié par nom dans l'ordre naturel. */
export interface ChoixDesBiens {
  /** Aucune location en cours ni à venir. */
  readonly vacants: readonly BienAChoisir[];
  /** Tous les autres : une chambre de plus, un bail qui suit une sortie prévue. */
  readonly loues: readonly BienAChoisir[];
}

export function choixDesBiens(donnees: Donnees, aujourdhui: string): ChoixDesBiens {
  const biens = donnees.biens
    .map((bien) => ({ id: bien.id, nom: bien.nom, etat: etatDuBien(donnees, bien.id, aujourdhui) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  return {
    vacants: biens.filter((b) => b.etat.statut === 'vacant'),
    loues: biens.filter((b) => b.etat.statut !== 'vacant'),
  };
}

/**
 * Le bien choisi à l'ouverture (ADR-G21) : celui de l'adresse s'il existe, sinon le premier bien
 * vacant, sinon le premier bien ; `null` sans aucun bien.
 */
export function bienInitial(choix: ChoixDesBiens, demande: string | null): string | null {
  const tous = [...choix.vacants, ...choix.loues];
  const demandeConnue = tous.find((b) => b.id === demande);
  return (demandeConnue ?? tous[0])?.id ?? null;
}

/**
 * Un autre bien choisi : type, loyer, charges et jour repris de sa dernière location (ou vides) ;
 * nom, e-mail, colocataires, chambre, entrée, dépôt et APL restent comme tapés.
 */
export function apresChangementDeBien(
  saisie: SaisieLouer,
  derniere: LocationGeree | undefined,
  aujourdhui: string,
): SaisieLouer {
  const { type, loyer, charges, jourLoyer } = saisieLouer(derniere, aujourdhui);
  return { ...saisie, type, loyer, charges, jourLoyer };
}
