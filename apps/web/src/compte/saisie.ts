export const LONGUEUR_CODE = 6;

/** Une adresse plausible (un @, un domaine avec un point, aucun espace) ; le serveur valide pour de vrai. */
const ADRESSE_PLAUSIBLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailPlausible(email: string): boolean {
  return ADRESSE_PLAUSIBLE.test(email.trim());
}

/** « 482 913 » ou « 482-913 » deviennent « 482913 » : seuls les chiffres comptent, six au plus. */
export function normaliserCode(saisie: string): string {
  return saisie.replace(/\D/g, '').slice(0, LONGUEUR_CODE);
}

export function codeComplet(code: string): boolean {
  return code.length === LONGUEUR_CODE && /^\d+$/.test(code);
}

/**
 * Où revenir après la connexion : un chemin interne uniquement. Une URL externe, un chemin qui
 * commence par // ou /\ (interprété comme un autre site) ou la page de connexion elle-même donnent le défaut.
 */
export function cheminDeRetour(parametre: string | null, defaut = '/'): string {
  if (!parametre?.startsWith('/')) return defaut;
  if (parametre.startsWith('//') || parametre.startsWith('/\\')) return defaut;
  if (parametre === '/connexion' || parametre.startsWith('/connexion?')) return defaut;
  return parametre;
}
