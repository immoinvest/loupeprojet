import { trimestreDe } from '../../commun/dates.ts';
import { arrondir } from '../../commun/statistiques.ts';
import {
  UsurePublieeSchema,
  type SaisieUsure,
  type SeuilsUsure,
  type UsurePubliee,
} from '../../schemas/usure.ts';

export class ErreurSaisieUsure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurSaisieUsure';
  }
}

const CATEGORIES: readonly (keyof SeuilsUsure)[] = [
  'fixeMoins10Ans',
  'fixe10a20Ans',
  'fixe20AnsEtPlus',
  'variable',
  'relais',
];

/**
 * Contrôles d'une saisie : le trimestre est celui de la date d'application, et chaque seuil vaut le
 * taux effectif moyen augmenté d'un tiers, arrondi au centième de point (article L. 314-6 du code de la consommation).
 */
export function verifierSaisie(saisie: SaisieUsure): void {
  if (trimestreDe(saisie.applicableDu) !== saisie.trimestre) {
    throw new ErreurSaisieUsure(
      `${saisie.trimestre} : la date d'application ${saisie.applicableDu} n'est pas dans ce trimestre`,
    );
  }
  for (const categorie of CATEGORIES) {
    const attendu = arrondir((saisie.tauxEffectifsMoyens[categorie] * 4) / 3, 4);
    const seuil = saisie.seuils[categorie];
    if (Math.abs(attendu - seuil) > 1e-9) {
      throw new ErreurSaisieUsure(
        `${saisie.trimestre} ${categorie} : seuil ${String(seuil)} au lieu de ${String(attendu)} (taux moyen augmenté d'un tiers)`,
      );
    }
  }
}

export interface PublicationUsure {
  readonly trimestres: readonly UsurePubliee[];
  /** Trimestre le plus récent déjà applicable ; null si aucune saisie ne l'est encore. */
  readonly courant: UsurePubliee | null;
}

/** Fichiers publiés : un par trimestre saisi, `perime` quand ce n'est pas le trimestre du jour. */
export function publierUsure(
  saisies: readonly SaisieUsure[],
  aujourdhui: string,
  genereLe: string,
): PublicationUsure {
  const trimestreDuJour = trimestreDe(aujourdhui);
  const vus = new Set<string>();
  const trimestres = [...saisies]
    .sort((a, b) => a.applicableDu.localeCompare(b.applicableDu))
    .map((saisie) => {
      verifierSaisie(saisie);
      if (vus.has(saisie.trimestre)) {
        throw new ErreurSaisieUsure(`${saisie.trimestre} : saisi deux fois`);
      }
      vus.add(saisie.trimestre);
      return UsurePublieeSchema.parse({
        genereLe,
        millesime: saisie.trimestre,
        source: saisie.source,
        trimestre: saisie.trimestre,
        applicableDu: saisie.applicableDu,
        publieLe: saisie.publieLe,
        tauxEffectifsMoyens: saisie.tauxEffectifsMoyens,
        seuils: saisie.seuils,
        perime: saisie.trimestre !== trimestreDuJour,
      });
    });
  const applicables = trimestres.filter((trimestre) => trimestre.applicableDu <= aujourdhui);
  return { trimestres, courant: applicables.at(-1) ?? null };
}
