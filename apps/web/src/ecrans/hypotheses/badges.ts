import type { ProjetEntree } from '@loupe/moteur';

import { cleProvenance, type Descripteur } from '@/hypotheses';

import { BADGES, badgeDeSource, type BadgeProvenance } from './ChampHypothese';

/**
 * Le badge de provenance d'un champ d'hypothèse : sa source dans le projet, sinon « à toi » pour
 * une valeur que l'utilisateur seul connaît. Partagé par l'onglet Hypothèses et la liste de visite.
 */
export function badgePour(projet: ProjetEntree, d: Descripteur): BadgeProvenance | null {
  const badge = badgeDeSource(projet.provenance?.[cleProvenance(d.chemin)]);
  if (badge !== null) return badge;
  return d.aToi === true ? (BADGES.utilisateur ?? null) : null;
}
