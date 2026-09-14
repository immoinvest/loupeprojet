import type { JSX, ReactNode } from 'react';

import { Carte, TitreCarte } from '@/composants/ui';
import type { Descripteur } from '@/hypotheses';
import type { Colonne, Erreurs } from '@/simulateur';

import { ChampHypothese, type BadgeProvenance } from '../hypotheses/ChampHypothese';

/**
 * Une carte de champs du simulateur (le projet financé, l'offre A, l'offre B), rendue avec le
 * composant de champ de l'onglet Hypothèses. Les erreurs sont lues sous « <colonne>.<clé> ».
 */
export function FormulaireColonne({
  titre,
  colonne,
  champs,
  textes,
  erreurs,
  badge,
  onChange,
  action,
  pied,
}: {
  titre: string;
  colonne: Colonne;
  champs: readonly Descripteur[];
  textes: Readonly<Record<string, string>>;
  erreurs: Erreurs;
  badge: (d: Descripteur) => BadgeProvenance | null;
  onChange: (cle: string, texte: string) => void;
  /** À droite du titre (« Retirer l'offre B »). */
  action?: ReactNode;
  /** Sous les champs (« Ré-estimer » les frais de notaire). */
  pied?: ReactNode;
}): JSX.Element {
  return (
    <Carte>
      <TitreCarte action={action}>{titre}</TitreCarte>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {champs.map((d) => (
          <ChampHypothese
            key={d.chemin}
            descripteur={d}
            texte={textes[d.chemin] ?? ''}
            erreur={erreurs[`${colonne}.${d.chemin}`]}
            badge={badge(d)}
            onChange={(t) => {
              onChange(d.chemin, t);
            }}
          />
        ))}
      </div>
      {pied}
    </Carte>
  );
}
