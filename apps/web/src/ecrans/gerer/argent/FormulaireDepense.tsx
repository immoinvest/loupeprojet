import {
  CATEGORIES_DEPENSE,
  FREQUENCES,
  type BienGere,
  type NouvelleDepense,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, LienBouton } from '@/composants/ui';
import {
  lireDepense,
  SANS_BIEN,
  type ChampDepense,
  type ChoixFrequence,
  type SaisieDepense,
} from '@/gestion/argent/saisie-depense';
import type { ResultatArgent } from '@/gestion/argent/types';
import {
  CATEGORIES_TEXTE,
  ERREURS_ARGENT,
  ERREURS_DEPENSE,
  FREQUENCES_TEXTE,
  TEXTES_DEPENSE as T,
} from '@/textes/gerer-argent';

import { ChampGerer } from '../ChampGerer';
import { ListeChoix } from './ListeChoix';

const identifiant = (champ: ChampDepense): string => `depense-${champ}`;
const CHOIX_FREQUENCES: readonly ChoixFrequence[] = ['aucune', ...FREQUENCES];

export interface FormulaireDepenseProps {
  /** Nom du formulaire : « Nouvelle dépense » ou « Modifier la dépense ». */
  readonly titre: string;
  readonly biens: readonly BienGere[];
  readonly initiale: SaisieDepense;
  /** La page où « Annuler » ramène. */
  readonly annuler: string;
  readonly enregistrer: (depense: NouvelleDepense) => Promise<ResultatArgent<unknown>>;
  readonly onEnregistre: () => void;
}

/**
 * Une dépense : montant, date, catégorie, bien, libellé, récupérable, récurrence. Ouvert par un lien
 * (clic 1), envoyé par « Enregistrer » (clic 2) ; les listes et la case ne comptent pas comme des clics.
 */
export function FormulaireDepense({
  titre,
  biens,
  initiale,
  annuler,
  enregistrer,
  onEnregistre,
}: FormulaireDepenseProps): JSX.Element {
  const [saisie, setSaisie] = useState<SaisieDepense>(initiale);
  const [erreurs, setErreurs] = useState<readonly ChampDepense[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const changer = <K extends keyof SaisieDepense>(cle: K, valeur: SaisieDepense[K]): void => {
    setSaisie((s) => ({ ...s, [cle]: valeur }));
  };
  const erreur = (champ: ChampDepense): string | undefined =>
    erreurs.includes(champ) ? ERREURS_DEPENSE[champ] : undefined;
  const biensTries = [...biens].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));

  const soumettre = async (): Promise<void> => {
    const lu = lireDepense(saisie);
    if (!lu.ok) {
      setErreurs(lu.erreurs);
      document.getElementById(identifiant(lu.erreurs[0] ?? 'montant'))?.focus();
      return;
    }
    setErreurs([]);
    setEchec(null);
    setOccupe(true);
    const r = await enregistrer(lu.depense);
    setOccupe(false);
    if (r.ok) onEnregistre();
    else setEchec(ERREURS_ARGENT[r.code]);
  };

  return (
    <form
      noValidate
      aria-label={titre}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void soumettre();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampGerer
          id={identifiant('montant')}
          libelle={T.montant}
          valeur={saisie.montant}
          onChange={(v) => {
            changer('montant', v);
          }}
          erreur={erreur('montant')}
          inputMode="decimal"
          unite="€"
          autoComplete="off"
        />
        <ChampGerer
          id={identifiant('date')}
          libelle={T.date}
          type="date"
          valeur={saisie.date}
          onChange={(v) => {
            changer('date', v);
          }}
          erreur={erreur('date')}
        />
        <ListeChoix
          libelle={T.categorie}
          valeur={saisie.categorie}
          options={CATEGORIES_DEPENSE.map((c) => ({ valeur: c, libelle: CATEGORIES_TEXTE[c] }))}
          onChoix={(v) => {
            changer('categorie', v);
          }}
        />
        <ListeChoix
          libelle={T.bien}
          valeur={saisie.bienId}
          options={[
            { valeur: SANS_BIEN, libelle: T.aucunBien },
            ...biensTries.map((b) => ({ valeur: b.id, libelle: b.nom })),
          ]}
          onChoix={(v) => {
            changer('bienId', v);
          }}
        />
      </div>

      <ChampGerer
        id={identifiant('libelle')}
        libelle={T.libelle}
        valeur={saisie.libelle}
        onChange={(v) => {
          changer('libelle', v);
        }}
        erreur={erreur('libelle')}
        autoComplete="off"
      />

      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start font-semibold text-encre">
          <input
            type="checkbox"
            checked={saisie.recuperable}
            onChange={(e) => {
              changer('recuperable', e.target.checked);
            }}
            aria-describedby="depense-recuperable-aide"
            className="size-5 shrink-0 accent-accent pointer-coarse:size-6"
          />
          {T.recuperable}
        </label>
        <p id="depense-recuperable-aide" className="m-0 text-sm text-encre-3">
          {T.recuperableAide}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ListeChoix
          libelle={T.frequence}
          valeur={saisie.frequence}
          options={CHOIX_FREQUENCES.map((f) => ({ valeur: f, libelle: FREQUENCES_TEXTE[f] }))}
          onChoix={(v) => {
            changer('frequence', v);
          }}
        />
        {saisie.frequence !== 'aucune' && (
          <ChampGerer
            id={identifiant('jusquAu')}
            libelle={T.jusquAu}
            type="date"
            valeur={saisie.jusquAu}
            onChange={(v) => {
              changer('jusquAu', v);
            }}
            erreur={erreur('jusquAu')}
          />
        )}
      </div>

      {echec !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {echec}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <LienBouton to={annuler}>{T.annuler}</LienBouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrer}
        </Bouton>
      </div>
    </form>
  );
}
