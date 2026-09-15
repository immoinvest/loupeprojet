import { useState, type JSX } from 'react';

import { periodeDeAnnee, type CodePeriode, type PeriodeConstruction } from '@/verifier/periodes';

import { Tuiles } from './Tuiles';

export interface PropsSaisieAnnee {
  /** Id de la saisie de l'année exacte. */
  readonly id: string;
  /** Nom de la saisie de l'année exacte. */
  readonly nom: string;
  /** Nom du groupe de tuiles des périodes, unique dans la page. */
  readonly nomPeriodes: string;
  /** Id du libellé qui nomme les tuiles. */
  readonly idLibelle: string;
  /** L'année en texte (« 1972 »), `''` inconnue. */
  readonly valeur: string;
  /** L'année est connue exactement (sinon, c'est l'année représentative d'une période). */
  readonly exacte: boolean;
  readonly periodes: readonly PeriodeConstruction[];
  /** Une période choisie (son année représentative, `null` décochée) ou une année tapée. */
  readonly onChange: (valeur: string, periode: PeriodeConstruction | null | undefined) => void;
}

/**
 * L'année de construction par période (« 1949 à 1996 ») : choisir une période transmet l'année du
 * milieu. « Je connais l'année » ouvre la saisie exacte.
 */
export function SaisieAnnee({
  id,
  nom,
  nomPeriodes,
  idLibelle,
  valeur,
  exacte,
  periodes,
  onChange,
}: PropsSaisieAnnee): JSX.Element {
  const [saisieOuverte, setSaisieOuverte] = useState(exacte);

  const choisir = (code: CodePeriode | ''): void => {
    const periode = periodes.find((p) => p.code === code);
    if (periode === undefined) {
      onChange('', null);
      return;
    }
    onChange(String(periode.representative), periode);
    setSaisieOuverte(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <Tuiles<CodePeriode>
        nom={nomPeriodes}
        idLibelle={idLibelle}
        options={periodes.map((p) => ({ valeur: p.code, libelle: p.libelle }))}
        valeur={periodeDeAnnee(valeur, periodes)}
        effacable
        onChange={choisir}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={saisieOuverte}
          aria-controls={id}
          onClick={() => {
            setSaisieOuverte(!saisieOuverte);
          }}
          className="min-h-[44px] self-start text-sm font-bold text-accent survol-texte"
        >
          {saisieOuverte ? 'Je ne connais que la période' : "Je connais l'année"}
        </button>
        {saisieOuverte && (
          <input
            id={id}
            name={nom}
            aria-label="Année exacte"
            value={exacte ? valeur : ''}
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            placeholder="1972"
            onChange={(e) => {
              onChange(e.target.value.replace(/\D/g, ''), undefined);
            }}
            className="min-h-[44px] w-24 rounded-encart border border-bordure bg-surface px-3 text-center text-[15px] font-semibold pointer-coarse:text-base"
          />
        )}
      </div>
    </div>
  );
}
