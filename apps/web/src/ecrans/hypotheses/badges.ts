import type { ProjetEntree } from '@loupe/moteur';

import { cleProvenance, type Descripteur } from '@/hypotheses';

import type { BadgeProvenance } from './ChampHypothese';

/** Badge de provenance d'une hypothèse, par code de provenance du projet. */
export const BADGES: Readonly<Record<string, BadgeProvenance>> = {
  annonce: { ton: 'neutre', libelle: 'annonce' },
  utilisateur: { ton: 'accent', libelle: 'à toi' },
  estime: { ton: 'surveiller', libelle: 'estimé' },
  ademe: { ton: 'bon', libelle: 'donnée publique' },
  anil: { ton: 'bon', libelle: 'donnée publique' },
  dvf: { ton: 'bon', libelle: 'donnée publique' },
  usure: { ton: 'bon', libelle: 'taux du mois' },
};

export function badgePour(projet: ProjetEntree, d: Descripteur): BadgeProvenance | null {
  const source = projet.provenance?.[cleProvenance(d.chemin)];
  if (source !== undefined) return BADGES[source] ?? { ton: 'neutre', libelle: source };
  return d.aToi === true ? (BADGES.utilisateur ?? null) : null;
}
