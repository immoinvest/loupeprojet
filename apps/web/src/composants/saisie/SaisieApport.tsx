import { useRef, type JSX } from 'react';

import type { ChoixApport, PartApport } from '@/verifier/deductions';

import { ChampMontant } from './ChampMontant';
import { Tuiles } from './Tuiles';

const OPTIONS: readonly { valeur: ChoixApport; libelle: string }[] = [
  { valeur: '0', libelle: '0 %' },
  { valeur: '0.1', libelle: '10 %' },
  { valeur: '0.2', libelle: '20 %' },
  { valeur: 'autre', libelle: 'Autre' },
];

export interface PropsSaisieApport {
  /** Id de la saisie du montant, nommée par le libellé du champ. */
  readonly id: string;
  /** Nom de la saisie ; le groupe de tuiles s'appelle `part-<nom>`. */
  readonly nom: string;
  /** Le montant en texte brut (« 16100 »). */
  readonly valeur: string;
  /** La tuile cochée (`choixApport`). */
  readonly choix: ChoixApport;
  /** Les parts qu'on ne peut pas calculer (coût total inconnu). */
  readonly indisponibles?: readonly PartApport[];
  /** Une tuile de part choisie. */
  readonly onPart: (part: PartApport) => void;
  /** Un montant tapé. */
  readonly onChange: (valeur: string) => void;
  readonly decritPar?: string | undefined;
  readonly invalide?: boolean;
}

/**
 * L'apport en tuiles de part du coût total, le montant en euros sous les tuiles : le taper coche « Autre »,
 * cocher « Autre » place le curseur dans le montant.
 */
export function SaisieApport({
  id,
  nom,
  valeur,
  choix,
  indisponibles = [],
  onPart,
  onChange,
  decritPar,
  invalide = false,
}: PropsSaisieApport): JSX.Element {
  const saisie = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <Tuiles<ChoixApport>
        nom={`part-${nom}`}
        libelle="Part du coût total"
        options={OPTIONS.map((o) =>
          o.valeur !== 'autre' && indisponibles.includes(o.valeur) ? { ...o, desactivee: true } : o,
        )}
        valeur={choix}
        onChange={(v) => {
          if (v === 'autre' || v === '') saisie.current?.querySelector('input')?.focus();
          else onPart(v);
        }}
      />
      <div ref={saisie} className="max-w-60">
        <ChampMontant
          id={id}
          nom={nom}
          valeur={valeur}
          onChange={onChange}
          unite="€"
          decritPar={decritPar}
          invalide={invalide}
        />
      </div>
    </div>
  );
}
