import type { ProjetEntree } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { Ligne } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  appliquerSaisie,
  cleProvenance,
  texteLisible,
  valeurActuelle,
  versTexte,
  type Descripteur,
  type Groupe,
} from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';

import { BADGES, ChampHypothese, badgeDeSource, type BadgeProvenance } from './ChampHypothese';

function badgePour(projet: ProjetEntree, d: Descripteur): BadgeProvenance | null {
  const badge = badgeDeSource(projet.provenance?.[cleProvenance(d.chemin)]);
  if (badge !== null) return badge;
  return d.aToi === true ? (BADGES.utilisateur ?? null) : null;
}

function champsVisibles(groupe: Groupe, projet: ProjetEntree): readonly Descripteur[] {
  return groupe.champs.filter((d) => d.visibleSi === undefined || d.visibleSi(projet));
}

/**
 * La grille éditable d'un groupe d'hypothèses : chaque saisie passe par `appliquerSaisie`,
 * puis par `mettreAJour` (validation Zod) ; une valeur refusée affiche son message et la
 * dernière valeur valide reste en vigueur.
 */
export function GrilleHypotheses({ groupe }: { groupe: Groupe }): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const projet: ProjetEntree = enregistre.projet;
  const [textes, setTextes] = useState<Readonly<Record<string, string>>>({});
  const [erreurs, setErreurs] = useState<Readonly<Record<string, string>>>({});

  const changer = (d: Descripteur, texte: string): void => {
    setTextes((prev) => ({ ...prev, [d.chemin]: texte }));
    const application = appliquerSaisie(projet, d, texte);
    if (!application.ok) {
      setErreurs((prev) => ({ ...prev, [d.chemin]: application.erreur }));
      return;
    }
    const resultat = mettreAJour(enregistre.id, application.projet);
    if (!resultat.ok) {
      const message =
        resultat.erreurs[d.chemin] ?? Object.values(resultat.erreurs)[0] ?? 'Valeur refusée.';
      setErreurs((prev) => ({ ...prev, [d.chemin]: message }));
      return;
    }
    setErreurs((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== d.chemin)));
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {champsVisibles(groupe, projet).map((d) => (
        <ChampHypothese
          key={d.chemin}
          descripteur={d}
          texte={textes[d.chemin] ?? versTexte(valeurActuelle(projet, d), d.type)}
          erreur={erreurs[d.chemin]}
          badge={badgePour(projet, d)}
          onChange={(t) => {
            changer(d, t);
          }}
        />
      ))}
    </div>
  );
}

/** Le même groupe en lignes lisibles, pour un document (impression, projet partagé). */
export function LignesHypotheses({ groupe }: { groupe: Groupe }): JSX.Element {
  const { enregistre } = useProjetCourant();
  const projet: ProjetEntree = enregistre.projet;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10 print:grid-cols-2 print:gap-x-10">
      {champsVisibles(groupe, projet).map((d) => (
        <Ligne
          key={d.chemin}
          libelle={d.libelle}
          valeur={texteLisible(d, valeurActuelle(projet, d))}
        />
      ))}
    </div>
  );
}
