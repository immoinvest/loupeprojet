import { useState, type JSX } from 'react';

import { Compteur } from '@/composants/saisie/Compteur';
import { Tuiles } from '@/composants/saisie/Tuiles';

import { Champ } from './Champ';
import type { ContexteFormulaire } from './contexte';

const DUREES = ['15', '20', '25'] as const;
type ChoixDuree = (typeof DUREES)[number] | 'autre';

const OPTIONS: readonly { valeur: ChoixDuree; libelle: string }[] = [
  ...DUREES.map((d) => ({ valeur: d, libelle: `${d} ans` })),
  { valeur: 'autre', libelle: 'Autre' },
];

/** La durée du prêt : les durées que proposent les banques en tuiles, « Autre » ouvre un compteur de 1 à 30 ans. */
export function ChoixDuree({ c }: { c: ContexteFormulaire }): JSX.Element {
  const valeur = c.valeurs.dureeAnnees.trim();
  const courante = (DUREES as readonly string[]).includes(valeur);
  const [autre, setAutre] = useState(!courante);
  const choix: ChoixDuree = autre || !courante ? 'autre' : (valeur as ChoixDuree);

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
        <div className="flex flex-wrap items-center gap-3">
          <Tuiles<ChoixDuree>
            nom="duree-pret"
            idLibelle={idLibelle}
            decritPar={decritPar}
            options={OPTIONS}
            valeur={choix}
            onChange={(v) => {
              if (v === 'autre') {
                setAutre(true);
              } else if (v !== '') {
                setAutre(false);
                c.changer('dureeAnnees', v);
              }
            }}
          />
          {choix === 'autre' && (
            <Compteur
              id={`${idLibelle}-annees`}
              nom="dureeAnnees"
              libelle="Nombre d'années"
              valeur={c.valeurs.dureeAnnees}
              onChange={(v) => {
                c.changer('dureeAnnees', v);
              }}
              min={1}
              max={30}
              depart={25}
              nomMoins="Un an de moins"
              nomPlus="Un an de plus"
              suffixe={() => 'ans'}
              decritPar={decritPar}
              invalide={invalide}
            />
          )}
        </div>
      )}
    </Champ>
  );
}
