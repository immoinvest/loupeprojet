import {
  periodeDe,
  PREFERENCES_PAR_DEFAUT,
  PreferencesMenuSchema,
  resumeDuMois,
  type EtatGestion,
  type PreferencesMenu,
} from '@loupe/gestion';

import type { EtatCompte } from '@/compte/CompteContext';

/** Mémoire locale des préférences : le bon menu dès le chargement suivant, avant la réponse de l'API. */
export const CLE_MENU = 'deklic.menu.v1';

/** Sans compte, les deux sections ; sinon les préférences connues (celles du compte, ou leur copie locale). */
export function sectionsAffichees(
  etatCompte: EtatCompte,
  preferences: PreferencesMenu,
): PreferencesMenu {
  return etatCompte === 'anonyme' ? PREFERENCES_PAR_DEFAUT : preferences;
}

/** Les trois menus possibles : au moins une section est toujours affichée, par construction. */
export const CHOIX_MENU = ['les_deux', 'analyser', 'gerer'] as const;
export type ChoixMenu = (typeof CHOIX_MENU)[number];

const PREFERENCES_DU_CHOIX: Readonly<Record<ChoixMenu, PreferencesMenu>> = {
  les_deux: { analyser: true, gerer: true },
  analyser: { analyser: true, gerer: false },
  gerer: { analyser: false, gerer: true },
};

export function preferencesDe(choix: ChoixMenu): PreferencesMenu {
  return PREFERENCES_DU_CHOIX[choix];
}

/** Le choix correspondant aux préférences ; aucune section (impossible par le schéma) vaut les deux. */
export function choixDe(preferences: PreferencesMenu): ChoixMenu {
  if (preferences.analyser === preferences.gerer) return 'les_deux';
  return preferences.analyser ? 'analyser' : 'gerer';
}

export function lirePreferencesLocales(stockage: Storage): PreferencesMenu | null {
  try {
    const lu = PreferencesMenuSchema.safeParse(JSON.parse(stockage.getItem(CLE_MENU) ?? 'null'));
    return lu.success ? lu.data : null;
  } catch {
    return null;
  }
}

export function ecrirePreferencesLocales(stockage: Storage, preferences: PreferencesMenu): void {
  try {
    stockage.setItem(CLE_MENU, JSON.stringify(preferences));
  } catch {
    // Stockage refusé ou plein : le menu reste juste pour cette visite.
  }
}

/** Le nombre de loyers en retard du mois en cours, pour la pastille du menu. */
export function retardsDuMois(donnees: EtatGestion | null, aujourdhui: string): number {
  if (donnees === null) return 0;
  return resumeDuMois(donnees, periodeDe(aujourdhui), aujourdhui).nombreEnRetard;
}
