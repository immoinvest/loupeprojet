import type { JSX } from 'react';

import { SaisieAnnee } from '@/composants/saisie/SaisieAnnee';

import { Champ } from './Champ';
import type { ContexteFormulaire } from './contexte';

/**
 * L'année de construction par période (« 1949 à 1996 ») : l'année transmise est celle du milieu, marquée
 * « estimé ». « Je connais l'année » ouvre la saisie exacte ; une année lue dans l'annonce s'y affiche.
 */
export function ChoixAnnee({ c }: { c: ContexteFormulaire }): JSX.Element {
  return (
    <Champ
      groupe
      large
      libelle="Année de construction"
      provenance={c.provenance.annee}
      terme="anneeConstruction"
    >
      {({ id, idLibelle }) => (
        <SaisieAnnee
          id={id}
          nom="annee"
          nomPeriodes="periode-construction"
          idLibelle={idLibelle}
          valeur={c.valeurs.annee}
          exacte={c.valeurs.annee !== '' && c.provenance.annee !== 'estime'}
          periodes={c.periodes}
          onChange={(annee, periode) => {
            if (periode === undefined) c.changer('annee', annee);
            else c.poser({ annee }, { annee: periode === null ? undefined : 'estime' });
          }}
        />
      )}
    </Champ>
  );
}
