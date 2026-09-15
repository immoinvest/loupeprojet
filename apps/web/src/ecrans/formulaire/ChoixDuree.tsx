import type { JSX } from 'react';

import { SaisieDuree } from '@/composants/saisie/SaisieDuree';

import { Champ } from './Champ';
import type { ContexteFormulaire } from './contexte';

/** La durée du prêt : les durées que proposent les banques en tuiles, « Autre » ouvre un compteur de 1 à 30 ans. */
export function ChoixDuree({ c }: { c: ContexteFormulaire }): JSX.Element {
  return (
    <Champ
      groupe
      large
      aToi
      libelle="Durée du prêt"
      provenance={c.provenance.dureeAnnees}
      erreur={c.erreurs.dureeAnnees}
    >
      {({ idLibelle, decritPar, invalide }) => (
        <SaisieDuree
          nom="duree-pret"
          nomCompteur="dureeAnnees"
          idLibelle={idLibelle}
          valeur={c.valeurs.dureeAnnees}
          onChange={(v) => {
            c.changer('dureeAnnees', v);
          }}
          decritPar={decritPar}
          invalide={invalide}
        />
      )}
    </Champ>
  );
}
