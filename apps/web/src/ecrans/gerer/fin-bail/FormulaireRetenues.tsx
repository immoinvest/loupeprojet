import type { RestitutionSaisie } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import {
  lireRestitution,
  RETENUE_VIDE,
  saisieRestitutionInitiale,
  type ChampRestitution,
  type SaisieRestitution,
} from '@/gestion/fin-bail/saisie';
import { TEXTES_DEPOT as T, TEXTES_FIN_BAIL } from '@/textes/gerer-fin-bail';

import { ChampGerer } from '../ChampGerer';

export interface FormulaireRetenuesProps {
  readonly id: string;
  /** La sortie de la location : les clés sont supposées remises ce jour-là. */
  readonly sortie: string;
  readonly aujourdhui: string;
  readonly occupe: boolean;
  readonly erreur: string | null;
  readonly onEnregistrer: (restitution: RestitutionSaisie) => Promise<void>;
  readonly onFermer: () => void;
}

/** « Retenues » (clic 1) ouvre ce formulaire ; « Enregistrer les retenues » (clic 2). */
export function FormulaireRetenues({
  id,
  sortie,
  aujourdhui,
  occupe,
  erreur,
  onEnregistrer,
  onFermer,
}: FormulaireRetenuesProps): JSX.Element {
  const [saisie, setSaisie] = useState<SaisieRestitution>(() => ({
    ...saisieRestitutionInitiale(sortie, aujourdhui),
    conforme: false,
  }));
  const [erreurs, setErreurs] = useState<readonly ChampRestitution[]>([]);
  const changerRetenue = (rang: number, champ: 'motif' | 'montant', valeur: string): void => {
    setSaisie((s) => ({
      ...s,
      retenues: s.retenues.map((r, i) => (i === rang ? { ...r, [champ]: valeur } : r)),
    }));
  };

  return (
    <form
      noValidate
      aria-label={T.formulaire}
      className="flex flex-col gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const lu = lireRestitution(saisie);
        if (!lu.ok) {
          setErreurs(lu.erreurs);
          document.getElementById(`${id}-${lu.erreurs[0] ?? 'clesLe'}`)?.focus();
          return;
        }
        setErreurs([]);
        void onEnregistrer(lu.restitution);
      }}
    >
      <div className="max-w-[16rem]">
        <ChampGerer
          id={`${id}-clesLe`}
          libelle={T.clesLe}
          type="date"
          valeur={saisie.clesLe}
          onChange={(clesLe) => {
            setSaisie((s) => ({ ...s, clesLe }));
          }}
          erreur={erreurs.includes('clesLe') ? T.erreurCles : undefined}
        />
      </div>

      {saisie.retenues.map((retenue, rang) => (
        // Les retenues n'ont pas d'identité propre : leur rang dans le formulaire suffit (une
        // retenue ne s'insère qu'à la fin, et rien ne se réordonne).
        <div key={rang} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <ChampGerer
              id={rang === 0 ? `${id}-retenues` : `${id}-motif-${String(rang)}`}
              libelle={T.motif}
              valeur={retenue.motif}
              onChange={(v) => {
                changerRetenue(rang, 'motif', v);
              }}
              autoComplete="off"
            />
          </div>
          <div className="w-[10rem]">
            <ChampGerer
              id={`${id}-montant-${String(rang)}`}
              libelle={T.montantRetenue}
              valeur={retenue.montant}
              onChange={(v) => {
                changerRetenue(rang, 'montant', v);
              }}
              inputMode="decimal"
              unite="€"
              autoComplete="off"
            />
          </div>
        </div>
      ))}
      {erreurs.includes('retenues') && (
        <p className="m-0 text-sm text-probleme-texte">{T.erreurRetenues}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Bouton
          onClick={() => {
            setSaisie((s) => ({ ...s, retenues: [...s.retenues, RETENUE_VIDE] }));
          }}
        >
          {T.ajouterRetenue}
        </Bouton>
        <Bouton disabled={occupe} onClick={onFermer}>
          {TEXTES_FIN_BAIL.fermer}
        </Bouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrerRetenues}
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
