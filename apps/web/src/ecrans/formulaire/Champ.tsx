import { useId, type JSX, type ReactNode } from 'react';

import type { Provenance } from '@/annonces';
import { Info } from '@/composants/info';
import { Pastille } from '@/composants/ui';
import { texteDuTerme, type CodeTerme } from '@/textes/glossaire';

/** Ce que l'enveloppe donne à sa commande pour la relier au libellé, à l'aide et à l'erreur. */
export interface IdsChamp {
  /** Id de la saisie, nommée par le `<label htmlFor>`. */
  readonly id: string;
  /** Id du libellé, pour nommer un groupe (tuiles, échelle) par `aria-labelledby`. */
  readonly idLibelle: string;
  readonly decritPar: string | undefined;
  readonly invalide: boolean;
}

export interface ChampProps {
  readonly libelle: string;
  readonly provenance?: Provenance | undefined;
  /** Valeur que la personne seule connaît : fond teinté et badge « à toi » sans autre provenance. */
  readonly aToi?: boolean;
  readonly erreur?: string | undefined;
  /** Phrase courte sous la commande : « Facultatif. Vide : le loyer de marché de la commune. » */
  readonly indication?: string | undefined;
  /** Terme technique expliqué par une icône ⓘ, hors du libellé. */
  readonly terme?: CodeTerme | undefined;
  /** La commande est un groupe (tuiles, échelle) : le libellé le nomme sans être un `<label>`. */
  readonly groupe?: boolean;
  /** Toute la largeur de la grille. */
  readonly large?: boolean;
  readonly children: (ids: IdsChamp) => ReactNode;
}

function Badge({
  provenance,
  aToi,
}: {
  provenance: Provenance | undefined;
  aToi: boolean;
}): JSX.Element | null {
  if (provenance === 'annonce') {
    return (
      <Pastille ton="neutre" compacte>
        annonce
      </Pastille>
    );
  }
  if (provenance === 'estime') {
    return (
      <Pastille ton="surveiller" compacte>
        estimé
      </Pastille>
    );
  }
  if (!aToi) return null;
  return (
    <Pastille ton="accent" compacte>
      à toi
    </Pastille>
  );
}

/**
 * L'enveloppe d'un champ du formulaire Vérifier : libellé, icône ⓘ du terme, badge de provenance
 * (« annonce », « estimé » pour un défaut affiché, « à toi »), commande, erreur ou indication.
 */
export function Champ({
  libelle,
  provenance,
  aToi = false,
  erreur,
  indication,
  terme,
  groupe = false,
  large = false,
  children,
}: ChampProps): JSX.Element {
  const id = useId();
  const idLibelle = `${id}-libelle`;
  const idAide = `${id}-aide`;
  const aide = erreur ?? indication;
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 rounded-encart p-2 ${aToi ? 'bg-accent-fond' : ''} ${large ? 'col-span-full' : ''}`}
    >
      <span className="flex min-h-6 items-center justify-between gap-2 text-xs text-encre-3">
        <span className="inline-flex items-center gap-1">
          {groupe ? (
            <span id={idLibelle}>{libelle}</span>
          ) : (
            <label id={idLibelle} htmlFor={id}>
              {libelle}
            </label>
          )}
          {terme !== undefined && <Info sujet={libelle} texte={texteDuTerme(terme)} />}
        </span>
        <Badge provenance={provenance} aToi={aToi} />
      </span>
      {children({
        id,
        idLibelle,
        decritPar: aide === undefined ? undefined : idAide,
        invalide: erreur !== undefined,
      })}
      {aide !== undefined && (
        <span
          id={idAide}
          className={`text-xs ${erreur === undefined ? 'text-encre-3' : 'text-probleme'}`}
        >
          {aide}
        </span>
      )}
    </div>
  );
}
