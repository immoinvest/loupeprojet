import type { ProjetEntree } from '@loupe/moteur';
import { useId, type JSX, type ReactNode } from 'react';

import { EnveloppeChamp } from '@/composants/saisie/EnveloppeChamp';
import { Pastille, type TonPastille } from '@/composants/ui';
import type { Descripteur } from '@/hypotheses';
import { commandeDe, type TypeCommande } from '@/hypotheses/commandes';

import { CommandeHypothese } from './CommandeHypothese';

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

/** Commandes nommées par le libellé comme un groupe (boutons radio), sans `<label htmlFor>`. */
const EN_GROUPE: ReadonlySet<TypeCommande> = new Set([
  'ouiNon',
  'tuiles',
  'energie',
  'annee',
  'duree',
]);
/** Commandes qui prennent toute la largeur de la grille, comme dans Vérifier. */
const LARGES: ReadonlySet<TypeCommande> = new Set(['energie', 'annee', 'duree', 'apport']);

/**
 * Un champ d'hypothèse : l'enveloppe du formulaire Vérifier et la commande de sa nature (montant,
 * compteur, tuiles, échelle…). La commande écrit le texte qu'`appliquerSaisie` lit.
 */
export function ChampHypothese({
  descripteur: d,
  texte,
  erreur,
  badge,
  onChange,
  aide = d.aide,
  utilisePar,
  projet,
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
  /** Le projet, pour les commandes qui en dépendent (apport) ; sans lui, l'apport est un montant. */
  projet?: ProjetEntree | undefined;
}): JSX.Element {
  const nom = `${d.chemin}${useId()}`;
  const declare = commandeDe(d);
  const reglage =
    declare.type === 'apport' && projet === undefined
      ? commandeDe({ ...d, commande: 'montant' })
      : declare;
  return (
    <EnveloppeChamp
      champ={d.chemin}
      libelle={d.libelle}
      terme={d.terme}
      aToi={badge?.libelle === 'à toi'}
      badge={
        badge === null ? undefined : (
          <Pastille ton={badge.ton} compacte>
            {badge.libelle}
          </Pastille>
        )
      }
      groupe={EN_GROUPE.has(reglage.type)}
      libelleMasque={reglage.type === 'curseur'}
      large={LARGES.has(reglage.type)}
      erreur={erreur}
      indication={aide}
      pied={utilisePar}
    >
      {(ids) => (
        <CommandeHypothese
          descripteur={d}
          reglage={reglage}
          ids={ids}
          nom={nom}
          texte={texte}
          onChange={onChange}
          projet={projet}
        />
      )}
    </EnveloppeChamp>
  );
}
