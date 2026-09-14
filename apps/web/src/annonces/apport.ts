import { ProjetSchema, calculerFinancement, obtenirRegles, type ProjetEntree } from '@loupe/moteur';

/** Sans apport indiqué : 10 % du coût total du projet, ce que les banques demandent le plus souvent. */
export const PART_APPORT_DEFAUT = 0.1;
const ARRONDI_APPORT = 100;

/**
 * Coût total du projet : prix retenu, travaux, frais d'acquisition, frais bancaires et mobilier.
 * Il ne dépend pas de l'apport. `null` si le projet ne passe pas la validation du moteur.
 */
export function coutTotalDuProjet(projet: ProjetEntree): number | null {
  const valide = ProjetSchema.safeParse(projet);
  if (!valide.success) return null;
  return calculerFinancement(valide.data, obtenirRegles(valide.data.versionRegles), {
    avecTaeg: false,
  }).coutTotalProjet;
}

/** Une part du coût total (0,2 pour 20 %), arrondie à la centaine d'euros. */
export function apportPourPart(coutTotal: number, part: number): number {
  return Math.round((coutTotal * part) / ARRONDI_APPORT) * ARRONDI_APPORT;
}

/** L'apport par défaut d'un coût total : 10 %, arrondi à la centaine d'euros. */
export function apportParDefaut(coutTotal: number): number {
  return apportPourPart(coutTotal, PART_APPORT_DEFAUT);
}

/** Part de l'apport dans le coût total ; `null` sans coût total positif. */
export function partDuCoutTotal(apport: number, coutTotal: number | null): number | null {
  return coutTotal === null || coutTotal <= 0 ? null : apport / coutTotal;
}
