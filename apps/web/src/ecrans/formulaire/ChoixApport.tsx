import { useRef, type JSX } from 'react';

import { apportPourPart } from '@/annonces/apport';
import { ChampMontant } from '@/composants/saisie/ChampMontant';
import { Tuiles } from '@/composants/saisie/Tuiles';
import { choixApport, type ChoixApport as Choix } from '@/verifier/deductions';

import { Champ } from './Champ';
import type { ContexteFormulaire } from './contexte';

const OPTIONS: readonly { valeur: Choix; libelle: string }[] = [
  { valeur: '0', libelle: '0 %' },
  { valeur: '0.1', libelle: '10 %' },
  { valeur: '0.2', libelle: '20 %' },
  { valeur: 'autre', libelle: 'Autre' },
];

/**
 * L'apport en tuiles de part du coût total (10 % « estimé » par défaut, ce que demandent les banques) ; le
 * montant en euros reste sous les tuiles, modifiable : le taper coche « Autre ».
 */
export function ChoixApport({ c }: { c: ContexteFormulaire }): JSX.Element {
  const saisie = useRef<HTMLDivElement>(null);
  const { coutTotal } = c.apport;
  const choix = choixApport(c.valeurs.apport, c.provenance.apport === 'estime', coutTotal);

  const choisir = (valeur: Choix | ''): void => {
    if (valeur === '0.1') c.poser({ apport: '' }, { apport: 'estime' });
    else if (valeur === '0') c.changer('apport', '0');
    else if (valeur === '0.2' && coutTotal !== null) {
      c.changer('apport', String(apportPourPart(coutTotal, 0.2)));
    } else saisie.current?.querySelector('input')?.focus();
  };

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
        <div className="flex flex-col gap-2">
          <Tuiles<Choix>
            nom="part-apport"
            libelle="Part du coût total"
            options={OPTIONS.map((o) =>
              o.valeur === '0.2' && coutTotal === null ? { ...o, desactivee: true } : o,
            )}
            valeur={choix}
            onChange={choisir}
          />
          <div ref={saisie} className="max-w-60">
            <ChampMontant
              id={id}
              nom="apport"
              valeur={c.apport.texte}
              onChange={(v) => {
                c.changer('apport', v);
              }}
              unite="€"
              decritPar={decritPar}
              invalide={invalide}
            />
          </div>
        </div>
      )}
    </Champ>
  );
}
