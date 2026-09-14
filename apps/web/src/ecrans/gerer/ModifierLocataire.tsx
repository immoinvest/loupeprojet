import type { Locataire } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import { useGestion } from '@/gestion/GestionContext';
import { locataireDepuisSaisie, saisieLocataire, type SaisieLocataire } from '@/gestion/locataires';
import type { ChampLocataire } from '@/gestion/saisie';
import { ERREURS_GESTION } from '@/textes/gerer';
import { ERREURS_LOCATAIRE, TEXTES_LOCATAIRES as T } from '@/textes/gerer-locataires';

import { ChampGerer } from './ChampGerer';

/** « Modifier » (clic 1) ouvre ce formulaire prérempli ; « Enregistrer » (clic 2) corrige nom et e-mail. */
export function ModifierLocataire({
  locataire,
  onFermer,
}: {
  readonly locataire: Locataire;
  readonly onFermer: () => void;
}): JSX.Element {
  const { modifierLocataire } = useGestion();
  const [saisie, setSaisie] = useState<SaisieLocataire>(() => saisieLocataire(locataire));
  const [erreurs, setErreurs] = useState<readonly ChampLocataire[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const id = (champ: ChampLocataire): string => `locataire-${locataire.id}-${champ}`;
  const erreur = (champ: ChampLocataire): string | undefined =>
    erreurs.includes(champ) ? ERREURS_LOCATAIRE[champ] : undefined;

  const enregistrer = async (): Promise<void> => {
    const lu = locataireDepuisSaisie(saisie);
    if (!lu.ok) {
      setErreurs(lu.erreurs);
      document.getElementById(id(lu.erreurs[0] ?? 'locataire'))?.focus();
      return;
    }
    setErreurs([]);
    setOccupe(true);
    const r = await modifierLocataire(locataire.id, lu.locataire);
    setOccupe(false);
    if (r.ok) onFermer();
    else setEchec(ERREURS_GESTION[r.code]);
  };

  return (
    <form
      noValidate
      aria-label={T.formulaire}
      className="flex flex-col gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void enregistrer();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ChampGerer
          id={id('locataire')}
          libelle={T.nom}
          valeur={saisie.locataire}
          onChange={(valeur) => {
            setSaisie((s) => ({ ...s, locataire: valeur }));
          }}
          erreur={erreur('locataire')}
          autoComplete="off"
        />
        <ChampGerer
          id={id('email')}
          libelle={T.email}
          type="email"
          inputMode="email"
          valeur={saisie.email}
          onChange={(valeur) => {
            setSaisie((s) => ({ ...s, email: valeur }));
          }}
          erreur={erreur('email')}
          autoComplete="off"
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
      {echec !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {echec}
        </p>
      )}
    </form>
  );
}
