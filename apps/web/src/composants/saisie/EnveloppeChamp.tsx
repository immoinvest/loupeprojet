import { useId, type JSX, type ReactNode } from 'react';

import { useModeDocument } from '@/composants/document';
import { Info } from '@/composants/info';
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

export interface PropsEnveloppeChamp {
  readonly libelle: string;
  /** Le badge de provenance (« annonce », « estimé », « à toi »), à droite du libellé. */
  readonly badge?: ReactNode;
  /** Valeur que la personne seule connaît : fond teinté. */
  readonly aToi?: boolean;
  readonly erreur?: string | undefined;
  /** Phrase courte sous la commande ; l'erreur prend sa place quand il y en a une. */
  readonly indication?: string | undefined;
  /** Terme technique expliqué par une icône ⓘ, hors du libellé. */
  readonly terme?: CodeTerme | undefined;
  /** La commande est un groupe (tuiles, échelle) : le libellé le nomme sans être un `<label>`. */
  readonly groupe?: boolean;
  /** La commande affiche déjà son libellé (curseur) : celui de l'enveloppe n'est lu que par les lecteurs d'écran. */
  readonly libelleMasque?: boolean;
  /** Toute la largeur de la grille. */
  readonly large?: boolean;
  /** Chemin de l'hypothèse portée (`data-champ`), cible des liens « modifier … ». */
  readonly champ?: string | undefined;
  /** Sous l'aide (« Utilisé par »). */
  readonly pied?: ReactNode;
  readonly children: (ids: IdsChamp) => ReactNode;
}

/**
 * L'apparence d'un champ, la même dans le formulaire Vérifier et l'onglet Hypothèses : libellé, icône ⓘ
 * du terme, badge de provenance, commande, puis l'erreur ou l'indication. Dans un document, pas d'icône.
 */
export function EnveloppeChamp({
  libelle,
  badge,
  aToi = false,
  erreur,
  indication,
  terme,
  groupe = false,
  libelleMasque = false,
  large = false,
  champ,
  pied,
  children,
}: PropsEnveloppeChamp): JSX.Element {
  const id = useId();
  const document = useModeDocument();
  const idLibelle = `${id}-libelle`;
  const idAide = `${id}-aide`;
  const aide = erreur ?? indication;
  return (
    <div
      data-champ={champ}
      className={`flex min-w-0 flex-col gap-1 rounded-encart p-2 ${aToi ? 'bg-accent-fond' : ''} ${large ? 'col-span-full' : ''}`}
    >
      <span className="flex min-h-6 items-center justify-between gap-2 text-xs text-encre-3">
        {/* L'icône ⓘ reste hors du libellé : la toucher n'active pas la saisie. */}
        <span className="inline-flex items-center gap-1">
          {groupe || libelleMasque ? (
            <span id={idLibelle} className={libelleMasque ? 'sr-only' : undefined}>
              {libelle}
            </span>
          ) : (
            <label id={idLibelle} htmlFor={id}>
              {libelle}
            </label>
          )}
          {terme !== undefined && !document && <Info sujet={libelle} texte={texteDuTerme(terme)} />}
        </span>
        {badge}
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
      {pied}
    </div>
  );
}
