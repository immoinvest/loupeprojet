import type { ChangementColocataire, Locataire } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import {
  lireColocataire,
  saisieColocataireInitiale,
  SANS_SORTANT,
  type ChampColocataire,
  type SaisieColocataire,
} from '@/gestion/fin-bail/saisie';
import { TEXTES_COLOCATAIRE as T, TEXTES_FIN_BAIL } from '@/textes/gerer-fin-bail';

import { ListeChoix } from '../argent/ListeChoix';
import { ChampGerer } from '../ChampGerer';

export interface ChangerColocataireProps {
  readonly id: string;
  /** Les locataires présents aujourd'hui, dans l'ordre du bail. */
  readonly presents: readonly Locataire[];
  readonly aujourdhui: string;
  readonly occupe: boolean;
  readonly erreur: string | null;
  readonly onEnregistrer: (changement: ChangementColocataire) => Promise<void>;
  readonly onFermer: () => void;
}

const ERREURS: Readonly<Record<ChampColocataire, string>> = {
  sortantId: T.erreurSortant,
  dateDepart: T.erreurDate,
  arrivant: T.erreurArrivant,
  dateArrivee: T.erreurDate,
};

/**
 * « Changer de colocataire » (clic 1) ouvre ce formulaire ; « Enregistrer le changement » (clic 2).
 * Le bail continue : seules les quittances des mois suivants changent de noms (ADR-G38).
 */
export function ChangerColocataire({
  id,
  presents,
  aujourdhui,
  occupe,
  erreur,
  onEnregistrer,
  onFermer,
}: ChangerColocataireProps): JSX.Element {
  const [saisie, setSaisie] = useState<SaisieColocataire>(() =>
    saisieColocataireInitiale(aujourdhui),
  );
  const [erreurs, setErreurs] = useState<readonly ChampColocataire[]>([]);
  const changer = <C extends keyof SaisieColocataire>(
    cle: C,
    valeur: SaisieColocataire[C],
  ): void => {
    setSaisie((s) => ({ ...s, [cle]: valeur }));
  };
  const messageDe = (champ: ChampColocataire): string | undefined =>
    erreurs.includes(champ) ? ERREURS[champ] : undefined;

  return (
    <form
      noValidate
      aria-label={T.formulaire}
      className="flex flex-col gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const lu = lireColocataire(saisie);
        if (!lu.ok) {
          setErreurs(lu.erreurs);
          document.getElementById(`${id}-${lu.erreurs[0] ?? 'arrivant'}`)?.focus();
          return;
        }
        setErreurs([]);
        void onEnregistrer(lu.changement);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ListeChoix
          libelle={T.qui}
          valeur={saisie.sortantId}
          options={[
            { valeur: SANS_SORTANT, libelle: T.personne },
            ...presents.map((l) => ({ valeur: l.id, libelle: `${l.prenom} ${l.nom}` })),
          ]}
          onChoix={(sortantId) => {
            changer('sortantId', sortantId);
          }}
        />
        {saisie.sortantId !== SANS_SORTANT && (
          <ChampGerer
            id={`${id}-dateDepart`}
            libelle={T.dateDepart}
            type="date"
            valeur={saisie.dateDepart}
            onChange={(v) => {
              changer('dateDepart', v);
            }}
            erreur={messageDe('dateDepart')}
          />
        )}
        <ChampGerer
          id={`${id}-arrivant`}
          libelle={T.arrivant}
          valeur={saisie.arrivant}
          onChange={(v) => {
            changer('arrivant', v);
          }}
          erreur={messageDe('arrivant') ?? messageDe('sortantId')}
          aide={T.aideArrivant}
          autoComplete="off"
        />
        {saisie.arrivant.trim() !== '' && (
          <>
            <ChampGerer
              id={`${id}-email`}
              libelle={T.email}
              type="email"
              inputMode="email"
              valeur={saisie.email}
              onChange={(v) => {
                changer('email', v);
              }}
              autoComplete="off"
            />
            <ChampGerer
              id={`${id}-dateArrivee`}
              libelle={T.dateArrivee}
              type="date"
              valeur={saisie.dateArrivee}
              onChange={(v) => {
                changer('dateArrivee', v);
              }}
              erreur={messageDe('dateArrivee')}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Bouton disabled={occupe} onClick={onFermer}>
          {TEXTES_FIN_BAIL.fermer}
        </Bouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrer}
        </Bouton>
      </div>
      {erreur !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}
    </form>
  );
}
