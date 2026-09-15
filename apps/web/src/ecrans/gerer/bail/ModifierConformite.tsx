import { CLASSES_DPE, type LegalBienSaisie } from '@loupe/gestion';
import { ChevronDown } from 'lucide-react';
import { useState, type JSX } from 'react';

import { MenuChoix } from '@/composants/MenuChoix';
import { Bouton } from '@/composants/ui';
import type { LegalEffectif } from '@/gestion/bail/vue';
import {
  choixClasse,
  choixOuiNon,
  lireConformite,
  type ChoixClasse,
  type ChoixOuiNon,
} from '@/gestion/bail/saisie';
import { TEXTES_CONFORMITE as T } from '@/textes/gerer-bail';

import { ChampGerer } from '../ChampGerer';

export const CLASSE_LISTE =
  'flex min-h-[48px] w-full min-w-0 items-center justify-between gap-3 rounded-encart border border-bordure bg-surface px-4 text-left text-[16px] font-semibold text-encre survol-fond';

export const CHEVRON = (
  <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-encre-3" />
);

/** Classe, date du DPE et zone tendue ; « Enregistrer » envoie tout (valeurs inconnues comprises). */
export function ModifierConformite({
  id,
  legal,
  occupe,
  erreur,
  onEnregistrer,
  onFermer,
}: {
  readonly id: string;
  readonly legal: LegalEffectif;
  readonly occupe: boolean;
  readonly erreur: string | null;
  readonly onEnregistrer: (saisie: LegalBienSaisie) => Promise<void>;
  readonly onFermer: () => void;
}): JSX.Element {
  const [classe, setClasse] = useState<ChoixClasse>(choixClasse(legal.dpeClasse));
  const [date, setDate] = useState(legal.dpeDate ?? '');
  const [zone, setZone] = useState<ChoixOuiNon>(choixOuiNon(legal.zoneTendue));
  const [dateInvalide, setDateInvalide] = useState(false);

  return (
    <form
      aria-label={T.formulaire}
      className="flex flex-col gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const lu = lireConformite({ classe, date, zone });
        setDateInvalide(!lu.ok);
        if (lu.ok) void onEnregistrer(lu.saisie);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-encre-2">{T.classe}</span>
          <MenuChoix<ChoixClasse>
            libelle={T.classe}
            valeur={classe}
            groupes={[
              {
                nom: T.classe,
                options: [
                  ...CLASSES_DPE.map((c) => ({ valeur: c, libelle: c })),
                  { valeur: 'inconnue' as const, libelle: T.jeNeSaisPas },
                ],
              },
            ]}
            onChoix={setClasse}
            classeBouton={CLASSE_LISTE}
            apresValeur={CHEVRON}
          />
        </div>
        <ChampGerer
          id={`${id}-date`}
          libelle={T.dateDpe}
          type="date"
          valeur={date}
          onChange={setDate}
          erreur={dateInvalide ? T.erreurDate : undefined}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-encre-2">{T.zone}</span>
          <MenuChoix<ChoixOuiNon>
            libelle={T.zone}
            valeur={zone}
            groupes={[
              {
                nom: T.zone,
                options: [
                  { valeur: 'oui', libelle: T.oui },
                  { valeur: 'non', libelle: T.non },
                  { valeur: 'inconnue', libelle: T.jeNeSaisPas },
                ],
              },
            ]}
            onChoix={setZone}
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
