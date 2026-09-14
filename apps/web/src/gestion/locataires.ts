import type {
  BienGere,
  EtatGestion,
  Locataire,
  LocationGeree,
  NouveauLocataire,
} from '@loupe/gestion';

import { lireLocataire, type ChampLocataire } from './saisie';

type Donnees = Pick<EtatGestion, 'biens' | 'locataires' | 'locations'>;

export interface OccupationDuLocataire {
  readonly location: LocationGeree;
  /** Le bien de la location ; absent si les données sont incohérentes. */
  readonly bien: BienGere | undefined;
}

/** Une ligne de « Mes locataires » (ADR-G18 : calculée depuis l'état, sans route dédiée). */
export interface LigneLocataire {
  readonly locataire: Locataire;
  /** Ses locations, en titre ou en colocation, par date d'entrée. */
  readonly occupations: readonly OccupationDuLocataire[];
  /** La première entrée. */
  readonly entree: string;
  /** La dernière sortie ; absente tant qu'une de ses locations n'a pas de fin. */
  readonly sortie?: string;
}

export interface GroupesDeLocataires {
  /** Location en cours ou à venir. */
  readonly enCeMoment: readonly LigneLocataire[];
  /** Toutes les locations terminées. */
  readonly anciens: readonly LigneLocataire[];
}

function ligneDe(donnees: Donnees, locataire: Locataire): LigneLocataire | null {
  const locations = donnees.locations
    .filter((l) => l.locataireId === locataire.id || l.colocataireIds.includes(locataire.id))
    .sort((a, b) => a.debut.localeCompare(b.debut));
  const [premiere] = locations;
  if (premiere === undefined) return null;
  const sorties = locations.flatMap((l) => (l.fin === undefined ? [] : [l.fin])).sort();
  const sortie = sorties.length === locations.length ? sorties.at(-1) : undefined;
  return {
    locataire,
    occupations: locations.map((location) => ({
      location,
      bien: donnees.biens.find((b) => b.id === location.bienId),
    })),
    entree: premiere.debut,
    ...(sortie === undefined ? {} : { sortie }),
  };
}

/** Les locataires qui ont au moins une location, triés par nom puis prénom : en ce moment, puis anciens. */
export function groupesDeLocataires(donnees: Donnees, aujourdhui: string): GroupesDeLocataires {
  const lignes = donnees.locataires
    .flatMap((locataire) => {
      const ligne = ligneDe(donnees, locataire);
      return ligne === null ? [] : [ligne];
    })
    .sort(
      (a, b) =>
        a.locataire.nom.localeCompare(b.locataire.nom, 'fr') ||
        a.locataire.prenom.localeCompare(b.locataire.prenom, 'fr'),
    );
  return {
    enCeMoment: lignes.filter((l) => l.sortie === undefined || l.sortie >= aujourdhui),
    anciens: lignes.filter((l) => l.sortie !== undefined && l.sortie < aujourdhui),
  };
}

/** Le formulaire « Modifier le locataire » tel que tapé. */
export interface SaisieLocataire {
  /** « Prénom Nom ». */
  readonly locataire: string;
  readonly email: string;
}

export type ResultatLocataire =
  | { readonly ok: true; readonly locataire: NouveauLocataire }
  | { readonly ok: false; readonly erreurs: readonly ChampLocataire[] };

export function saisieLocataire(locataire: Locataire): SaisieLocataire {
  return { locataire: `${locataire.prenom} ${locataire.nom}`, email: locataire.email ?? '' };
}

/** Le locataire à envoyer (mêmes règles que la création), ou les champs à corriger. */
export function locataireDepuisSaisie(s: SaisieLocataire): ResultatLocataire {
  const erreurs: ChampLocataire[] = [];
  const locataire = lireLocataire(s, (champ) => {
    erreurs.push(champ);
  });
  return erreurs.length > 0 ? { ok: false, erreurs } : { ok: true, locataire };
}
