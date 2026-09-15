import type { JSX } from 'react';

import { apportPourPart } from '@/annonces/apport';
import { SaisieApport } from '@/composants/saisie/SaisieApport';
import { choixApport } from '@/verifier/deductions';

import { Champ } from './Champ';
import type { ContexteFormulaire } from './contexte';

/**
 * L'apport en tuiles de part du coût total (10 % « estimé » par défaut, ce que demandent les banques) ; le
 * montant en euros reste sous les tuiles, modifiable : le taper coche « Autre ».
 */
export function ChoixApport({ c }: { c: ContexteFormulaire }): JSX.Element {
  const { coutTotal } = c.apport;
  return (
    <Champ
      large
      aToi
      libelle="Apport"
      provenance={c.provenance.apport}
      erreur={c.erreurs.apport}
      indication={c.apport.indication}
      terme="apport"
    >
      {({ id, decritPar, invalide }) => (
        <SaisieApport
          id={id}
          nom="apport"
          valeur={c.apport.texte}
          choix={choixApport(c.valeurs.apport, c.provenance.apport === 'estime', coutTotal)}
          indisponibles={coutTotal === null ? ['0.2'] : []}
          onPart={(part) => {
            if (part === '0.1') c.poser({ apport: '' }, { apport: 'estime' });
            else if (part === '0') c.changer('apport', '0');
            else if (coutTotal !== null)
              c.changer('apport', String(apportPourPart(coutTotal, 0.2)));
          }}
          onChange={(v) => {
            c.changer('apport', v);
          }}
          decritPar={decritPar}
          invalide={invalide}
        />
      )}
    </Champ>
  );
}
