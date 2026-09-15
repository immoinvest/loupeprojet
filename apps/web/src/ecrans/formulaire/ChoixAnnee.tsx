import { useState, type JSX } from 'react';

import { Tuiles } from '@/composants/saisie/Tuiles';
import { periodeDeAnnee, type CodePeriode } from '@/verifier/periodes';

import { Champ } from './Champ';
import type { ContexteFormulaire } from './contexte';

/**
 * L'année de construction par période (« 1949 à 1996 ») : l'année transmise est celle du milieu, marquée
 * « estimé ». « Je connais l'année » ouvre la saisie exacte ; une année lue dans l'annonce s'y affiche.
 */
export function ChoixAnnee({ c }: { c: ContexteFormulaire }): JSX.Element {
  const exacte = c.valeurs.annee !== '' && c.provenance.annee !== 'estime';
  const [saisieOuverte, setSaisieOuverte] = useState(exacte);

  const choisir = (code: CodePeriode | ''): void => {
    const periode = c.periodes.find((p) => p.code === code);
    if (periode === undefined) {
      c.poser({ annee: '' }, { annee: undefined });
      return;
    }
    c.poser({ annee: String(periode.representative) }, { annee: 'estime' });
    setSaisieOuverte(false);
  };

  return (
    <Champ
      groupe
      large
      libelle="Année de construction"
      provenance={c.provenance.annee}
      terme="anneeConstruction"
    >
      {({ id, idLibelle }) => (
        <div className="flex flex-col gap-2">
          <Tuiles<CodePeriode>
            nom="periode-construction"
            idLibelle={idLibelle}
            options={c.periodes.map((p) => ({ valeur: p.code, libelle: p.libelle }))}
            valeur={periodeDeAnnee(c.valeurs.annee, c.periodes)}
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
                name="annee"
                aria-label="Année exacte"
                value={exacte ? c.valeurs.annee : ''}
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                placeholder="1972"
                onChange={(e) => {
                  c.changer('annee', e.target.value.replace(/\D/g, ''));
                }}
                className="min-h-[44px] w-24 rounded-encart border border-bordure bg-surface px-3 text-center text-[15px] font-semibold pointer-coarse:text-base"
              />
            )}
          </div>
        </div>
      )}
    </Champ>
  );
}
