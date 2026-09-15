import { FORMES_BAIL, type FormeBail, type RevisionSaisie } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { MenuChoix } from '@/composants/MenuChoix';
import { Bouton } from '@/composants/ui';
import { lireReglages, trimestresProposes } from '@/gestion/bail/saisie';
import type { RevisionEffective } from '@/gestion/bail/vue';
import { FORMES_BAIL_TEXTES, TEXTES_REVISION as T, trimestreEnLettres } from '@/textes/gerer-bail';

import { ChampGerer } from '../ChampGerer';
import { CHEVRON, CLASSE_LISTE } from './ModifierConformite';

/** Révision active, date anniversaire, trimestre de référence de l'IRL, forme du bail. */
export function ReglagesRevision({
  id,
  revision,
  occupe,
  erreur,
  onEnregistrer,
  onFermer,
}: {
  readonly id: string;
  readonly revision: RevisionEffective;
  readonly occupe: boolean;
  readonly erreur: string | null;
  readonly onEnregistrer: (saisie: RevisionSaisie) => Promise<void>;
  readonly onFermer: () => void;
}): JSX.Element {
  const [active, setActive] = useState<'oui' | 'non'>(revision.active ? 'oui' : 'non');
  const [anniversaire, setAnniversaire] = useState(revision.anniversaire);
  const [trimestre, setTrimestre] = useState(revision.trimestre);
  const [formeBail, setFormeBail] = useState<FormeBail>(revision.formeBail);
  const [dateInvalide, setDateInvalide] = useState(false);

  return (
    <form
      aria-label={T.formulaire}
      className="flex flex-col gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const lu = lireReglages({ active, anniversaire, trimestre, formeBail });
        setDateInvalide(!lu.ok);
        if (lu.ok) void onEnregistrer(lu.saisie);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-encre-2">{T.active}</span>
          <MenuChoix<'oui' | 'non'>
            libelle={T.active}
            valeur={active}
            groupes={[
              {
                nom: T.active,
                options: [
                  { valeur: 'oui', libelle: T.activeOui },
                  { valeur: 'non', libelle: T.activeNon },
                ],
              },
            ]}
            onChoix={setActive}
            classeBouton={CLASSE_LISTE}
            apresValeur={CHEVRON}
          />
        </div>
        <ChampGerer
          id={`${id}-anniversaire`}
          libelle={T.anniversaire}
          type="date"
          valeur={anniversaire}
          onChange={setAnniversaire}
          erreur={dateInvalide ? T.erreurDate : undefined}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-encre-2">{T.trimestre}</span>
          <MenuChoix<string>
            libelle={T.trimestre}
            valeur={trimestre}
            groupes={[
              {
                nom: T.trimestre,
                options: trimestresProposes(revision.trimestre).map((t) => ({
                  valeur: t,
                  libelle: trimestreEnLettres(t),
                })),
              },
            ]}
            onChoix={setTrimestre}
            classeBouton={CLASSE_LISTE}
            apresValeur={CHEVRON}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-encre-2">{T.forme}</span>
          <MenuChoix<FormeBail>
            libelle={T.forme}
            valeur={formeBail}
            groupes={[
              {
                nom: T.forme,
                options: FORMES_BAIL.map((f) => ({ valeur: f, libelle: FORMES_BAIL_TEXTES[f] })),
              },
            ]}
            onChoix={setFormeBail}
            classeBouton={CLASSE_LISTE}
            apresValeur={CHEVRON}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Bouton disabled={occupe} onClick={onFermer}>
          {T.fermer}
        </Bouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrer}
        </Bouton>
      </div>
      {erreur !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}
    </form>
  );
}
