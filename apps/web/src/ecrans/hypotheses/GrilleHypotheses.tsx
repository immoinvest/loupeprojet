import type { ProjetEntree } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { Ligne } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  appliquerSaisie,
  texteLisible,
  valeurActuelle,
  versTexte,
  type Descripteur,
  type Groupe,
} from '@/hypotheses';
import { CHEMIN_MODE } from '@/hypotheses/groupes-location';
import { useProjets } from '@/stockage/ProjetsContext';

import { badgePour } from './badges';
import { ChampHypothese } from './ChampHypothese';

export function champsVisibles(groupe: Groupe, projet: ProjetEntree): readonly Descripteur[] {
  return groupe.champs
    .filter((d) => d.visibleSi === undefined || d.visibleSi(projet))
    .map((d) => {
      const { optionVisibleSi: garder, options } = d;
      if (garder === undefined || options === undefined) return d;
      return { ...d, options: options.filter((o) => garder(o.v, projet)) };
    });
}

export interface SaisieHypotheses {
  readonly projet: ProjetEntree;
  /** Applique un texte saisi : conversion, validation Zod, enregistrement, message d'erreur. */
  readonly changer: (d: Descripteur, texte: string) => void;
  /** Le champ éditable d'un descripteur, avec sa valeur, son erreur et son badge. */
  readonly rendre: (d: Descripteur) => JSX.Element;
}

/**
 * La saisie d'hypothèses du projet courant : chaque saisie passe par `appliquerSaisie`, puis par
 * `mettreAJour` (validation Zod) ; une valeur refusée affiche son message et la dernière valeur
 * valide reste en vigueur. Partagée par les grilles de Hypothèses et Financement et par la carte
 * « L'achat ».
 */
export function useSaisieHypotheses(): SaisieHypotheses {
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

  const rendre = (d: Descripteur): JSX.Element => (
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
  );

  return { projet, changer, rendre };
}

/** La grille éditable d'un groupe d'hypothèses. */
export function GrilleHypotheses({ groupe }: { groupe: Groupe }): JSX.Element {
  const { projet, rendre } = useSaisieHypotheses();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {/* Le type d'exploitation se choisit par les boutons en tête de sa carte, jamais dans la grille. */}
      {champsVisibles(groupe, projet)
        .filter((d) => d.chemin !== CHEMIN_MODE)
        .map(rendre)}
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
