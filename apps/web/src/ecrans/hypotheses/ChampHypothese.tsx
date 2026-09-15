import { useId, type JSX, type ReactNode } from 'react';

import { useModeDocument } from '@/composants/document';
import { Info } from '@/composants/info';
import { Pastille, type TonPastille } from '@/composants/ui';
import type { Descripteur } from '@/hypotheses';
import { texteDuTerme } from '@/textes/glossaire';

export interface BadgeProvenance {
  readonly ton: TonPastille;
  readonly libelle: string;
}

export const BADGES: Readonly<Record<string, BadgeProvenance>> = {
  annonce: { ton: 'neutre', libelle: 'annonce' },
  utilisateur: { ton: 'accent', libelle: 'à toi' },
  estime: { ton: 'surveiller', libelle: 'estimé' },
  ademe: { ton: 'bon', libelle: 'donnée publique' },
  anil: { ton: 'bon', libelle: 'donnée publique' },
  dvf: { ton: 'bon', libelle: 'donnée publique' },
  usure: { ton: 'bon', libelle: 'taux du mois' },
};

/** Le badge d'une source de provenance ; une source inconnue s'affiche telle quelle, aucune source : rien. */
export function badgeDeSource(source: string | undefined): BadgeProvenance | null {
  if (source === undefined) return null;
  return BADGES[source] ?? { ton: 'neutre', libelle: source };
}

const CLASSE_SAISIE =
  'min-h-[44px] w-full min-w-0 rounded-encart border bg-surface px-3 text-[15px] font-semibold pointer-coarse:text-base';

export function ChampHypothese({
  descripteur: d,
  texte,
  erreur,
  badge,
  onChange,
  aide = d.aide,
  utilisePar,
}: {
  descripteur: Descripteur;
  texte: string;
  erreur?: string | undefined;
  badge: BadgeProvenance | null;
  onChange: (texte: string) => void;
  /** Phrase d'aide sous le champ ; par défaut, celle du descripteur. */
  aide?: string | undefined;
  /** Les volets qui reprennent ce chiffre (« Utilisé par »), sous le champ. */
  utilisePar?: ReactNode;
}): JSX.Element {
  const id = useId();
  const document = useModeDocument();
  const bordure = erreur === undefined ? 'border-bordure' : 'border-probleme';
  const aToi = badge?.libelle === 'à toi';
  return (
    <div
      data-champ={d.chemin}
      className={`flex flex-col gap-1 rounded-encart p-2 ${aToi ? 'bg-accent-fond' : ''}`}
    >
      <span className="flex items-center justify-between gap-2 text-xs text-encre-3">
        {/* L'icône ⓘ reste hors du libellé : la toucher n'active pas la saisie. */}
        <span className="inline-flex items-center gap-1">
          <label htmlFor={id}>{d.libelle}</label>
          {d.terme !== undefined && !document && (
            <Info sujet={d.libelle} texte={texteDuTerme(d.terme)} />
          )}
        </span>
        {badge !== null && (
          <Pastille ton={badge.ton} compacte>
            {badge.libelle}
          </Pastille>
        )}
      </span>
      {d.options === undefined ? (
        <span className="flex items-center gap-2">
          <input
            id={id}
            name={d.chemin}
            value={texte}
            inputMode={d.type === 'texte' ? 'text' : 'decimal'}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            className={`${CLASSE_SAISIE} ${bordure}`}
          />
          {d.unite !== undefined && (
            <span className="text-xs whitespace-nowrap text-encre-3">{d.unite}</span>
          )}
        </span>
      ) : (
        <select
          id={id}
          name={d.chemin}
          value={texte}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className={`${CLASSE_SAISIE} ${bordure}`}
        >
          {d.obligatoire !== true && <option value="">?</option>}
          {d.options.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      )}
      {aide !== undefined && <span className="text-xs text-encre-3">{aide}</span>}
      {erreur !== undefined && <span className="text-xs text-probleme">{erreur}</span>}
      {utilisePar}
    </div>
  );
}
