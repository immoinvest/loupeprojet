import {
  moisModifiables,
  type LocationGeree,
  type ModificationLocation,
  type Paiement,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import { moisEnLettres } from '@/gestion/format';
import {
  modificationDepuisSaisie,
  saisieModification,
  type ChampModification,
  type SaisieModification,
} from '@/gestion/saisie-modifier';
import { ERREURS_MODIFIER, TEXTES_MODIFIER as T } from '@/textes/gerer-biens';

import { ChampGerer } from '../ChampGerer';

export interface ModifierLocationProps {
  readonly location: LocationGeree;
  readonly paiements: readonly Paiement[];
  readonly aujourdhui: string;
  readonly occupe: boolean;
  /** Une erreur de l'API (mois déjà payé, chambre déjà louée). */
  readonly erreur: string | null;
  /** `null` : rien n'a changé, il n'y a rien à envoyer. */
  readonly onEnregistrer: (modification: ModificationLocation | null) => Promise<void>;
  readonly onFermer: () => void;
}

/** « Modifier » (clic 1) ouvre ce formulaire prérempli ; « Enregistrer » (clic 2). */
export function ModifierLocation({
  location,
  paiements,
  aujourdhui,
  occupe,
  erreur,
  onEnregistrer,
  onFermer,
}: ModifierLocationProps): JSX.Element {
  const mois = moisModifiables(location, paiements, aujourdhui);
  const [saisie, setSaisie] = useState<SaisieModification>(() =>
    saisieModification(location, mois, aujourdhui),
  );
  const [erreurs, setErreurs] = useState<readonly ChampModification[]>([]);
  const id = (champ: keyof SaisieModification): string => `modifier-${location.id}-${champ}`;
  const changer =
    (champ: keyof SaisieModification) =>
    (valeur: string): void => {
      setSaisie((s) => ({ ...s, [champ]: valeur }));
    };
  const erreurDe = (champ: ChampModification): string | undefined =>
    erreurs.includes(champ) ? ERREURS_MODIFIER[champ] : undefined;

  return (
    <form
      aria-label={T.titre}
      className="flex flex-col gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const lu = modificationDepuisSaisie(location, saisie);
        if (!lu.ok) {
          setErreurs(lu.erreurs);
          const [premier] = lu.erreurs;
          if (premier !== undefined) document.getElementById(id(premier))?.focus();
          return;
        }
        setErreurs([]);
        void onEnregistrer(lu.modification);
      }}
    >
      {mois.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={id('aPartirDe')} className="text-sm font-semibold text-encre-2">
              {T.aPartirDe}
            </label>
            <select
              id={id('aPartirDe')}
              value={saisie.aPartirDe}
              onChange={(e) => {
                changer('aPartirDe')(e.target.value);
              }}
              className="min-h-[48px] w-full min-w-0 rounded-encart border border-bordure bg-surface px-3 text-[16px] text-encre"
            >
              {mois.map((m) => (
                <option key={m} value={m}>
                  {moisEnLettres(m)}
                </option>
              ))}
            </select>
          </div>
          <ChampGerer
            id={id('loyer')}
            libelle={T.loyer}
            valeur={saisie.loyer}
            onChange={changer('loyer')}
            erreur={erreurDe('loyer')}
            unite="€"
            inputMode="decimal"
          />
          <ChampGerer
            id={id('charges')}
            libelle={T.charges}
            valeur={saisie.charges}
            onChange={changer('charges')}
            erreur={erreurDe('charges')}
            unite="€"
            inputMode="decimal"
          />
        </div>
      ) : (
        <p className="m-0 text-sm text-encre-2">{T.tousRegles}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <ChampGerer
          id={id('jourLoyer')}
          libelle={T.jourLoyer}
          valeur={saisie.jourLoyer}
          onChange={changer('jourLoyer')}
          erreur={erreurDe('jourLoyer')}
          inputMode="numeric"
        />
        <ChampGerer
          id={id('depot')}
          libelle={T.depot}
          valeur={saisie.depot}
          onChange={changer('depot')}
          erreur={erreurDe('depot')}
          unite="€"
          inputMode="decimal"
        />
        <ChampGerer
          id={id('libelle')}
          libelle={T.libelle}
          valeur={saisie.libelle}
          onChange={changer('libelle')}
          erreur={erreurDe('libelle')}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Bouton disabled={occupe} onClick={onFermer}>
          {T.fermer}
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
