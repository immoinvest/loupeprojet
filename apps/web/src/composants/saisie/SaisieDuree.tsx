import { useState, type JSX } from 'react';

import { Compteur } from './Compteur';
import { Tuiles } from './Tuiles';

const DUREES = ['15', '20', '25'] as const;
type ChoixDuree = (typeof DUREES)[number] | 'autre';

const OPTIONS: readonly { valeur: ChoixDuree; libelle: string }[] = [
  ...DUREES.map((d) => ({ valeur: d, libelle: `${d} ans` })),
  { valeur: 'autre', libelle: 'Autre' },
];

export interface PropsSaisieDuree {
  /** Nom du groupe de boutons radio, unique dans la page. */
  readonly nom: string;
  /** Nom de la saisie du compteur « Autre ». */
  readonly nomCompteur: string;
  /** Id du libellé qui nomme les tuiles. */
  readonly idLibelle: string;
  /** Le nombre d'années en texte (« 25 »), `''` inconnu. */
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  readonly decritPar?: string | undefined;
  readonly invalide?: boolean;
}

/** La durée d'un prêt : les durées que proposent les banques en tuiles, « Autre » ouvre un compteur de 1 à 30 ans. */
export function SaisieDuree({
  nom,
  nomCompteur,
  idLibelle,
  valeur,
  onChange,
  decritPar,
  invalide = false,
}: PropsSaisieDuree): JSX.Element {
  const courante = (DUREES as readonly string[]).includes(valeur.trim());
  const [autre, setAutre] = useState(!courante);
  const choix: ChoixDuree = autre || !courante ? 'autre' : (valeur.trim() as ChoixDuree);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tuiles<ChoixDuree>
        nom={nom}
        idLibelle={idLibelle}
        decritPar={decritPar}
        options={OPTIONS}
        valeur={choix}
        onChange={(v) => {
          if (v === 'autre') {
            setAutre(true);
          } else if (v !== '') {
            setAutre(false);
            onChange(v);
          }
        }}
      />
      {choix === 'autre' && (
        <Compteur
          id={`${idLibelle}-annees`}
          nom={nomCompteur}
          libelle="Nombre d'années"
          valeur={valeur}
          onChange={onChange}
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
  );
}
