import {
  periodeDe,
  PREFERENCES_PAR_DEFAUT,
  PreferencesMenuSchema,
  resumeDuMois,
  type EtatGestion,
  type PreferencesMenu,
} from '@loupe/gestion';

import type { EtatCompte } from '@/compte/CompteContext';

export type Section = keyof PreferencesMenu;

/** Mémoire locale des préférences : le bon menu dès le chargement suivant, avant la réponse de l'API. */
export const CLE_MENU = 'deklic.menu.v1';

/** Sans compte, les deux sections ; sinon les préférences connues (celles du compte, ou leur copie locale). */
export function sectionsAffichees(
  etatCompte: EtatCompte,
  preferences: PreferencesMenu,
): PreferencesMenu {
  return etatCompte === 'anonyme' ? PREFERENCES_PAR_DEFAUT : preferences;
}

/** Les préférences avec une section inversée, ou `null` si plus aucune section ne resterait affichée. */
export function basculer(preferences: PreferencesMenu, section: Section): PreferencesMenu | null {
  const suivantes = { ...preferences, [section]: !preferences[section] };
  return suivantes.analyser || suivantes.gerer ? suivantes : null;
}

/** Une section est figée quand c'est la seule affichée : on ne peut pas tout masquer. */
export function estFigee(preferences: PreferencesMenu, section: Section): boolean {
  return basculer(preferences, section) === null;
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
