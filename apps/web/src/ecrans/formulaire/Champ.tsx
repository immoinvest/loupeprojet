import type { JSX, ReactNode } from 'react';

import type { Provenance } from '@/annonces';
import { EnveloppeChamp, type IdsChamp } from '@/composants/saisie/EnveloppeChamp';
import { Pastille } from '@/composants/ui';
import type { CodeTerme } from '@/textes/glossaire';

export type { IdsChamp };

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
 * Un champ du formulaire Vérifier : l'enveloppe commune avec le badge tiré de la provenance du formulaire
 * (« annonce », « estimé » pour un défaut affiché, « à toi »).
 */
export function Champ({ provenance, aToi = false, ...props }: ChampProps): JSX.Element {
  return (
    <EnveloppeChamp {...props} aToi={aToi} badge={<Badge provenance={provenance} aToi={aToi} />} />
  );
}
