import type { ProjetEntree, Resultats } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { CURSEUR_NEGOCIATION, pourcentNegociation, pourcentPourViser } from '@/analyses';
import { Curseur } from '@/composants/Curseur';
import { Bouton, Carte } from '@/composants/ui';
import {
  CHEMINS_TRAVAUX,
  GROUPE_ACHAT,
  descripteurParChemin,
  lireChemin,
  type Descripteur,
} from '@/hypotheses';
import { PHRASES_ACHAT, libelleNegociation, phrasePrixRetenu, resumeTravaux } from '@/textes/achat';
import { eurosArrondis } from '@/textes/estimation';

const GRILLE = 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3';

const CHAMPS_PRINCIPAUX = GROUPE_ACHAT.champs.filter(
  (d) => !CHEMINS_TRAVAUX.includes(d.chemin) && d.chemin !== 'hypotheses.achat.negociationTaux',
);
const CHAMPS_TRAVAUX = CHEMINS_TRAVAUX.map(descripteurParChemin);
const NEGOCIATION = descripteurParChemin('hypotheses.achat.negociationTaux');

/**
 * La carte « L'achat » de l'onglet Hypothèses : prix et honoraires, la négociation (curseur et champ,
 * prix retenu, « Viser le prix estimé »), puis les travaux et le mobilier derrière un dépliant.
 * Chaque saisie passe par `changer`, comme les autres champs de l'onglet.
 */
export function CarteAchat({
  projet,
  resultats,
  rendre,
  changer,
}: {
  projet: ProjetEntree;
  resultats: Resultats;
  rendre: (d: Descripteur) => JSX.Element;
  changer: (d: Descripteur, texte: string) => void;
}): JSX.Element {
  const { achat, estimation } = resultats;
  const pourcent = pourcentNegociation(achat.negociationTaux);
  const vise =
    estimation === null
      ? null
      : pourcentPourViser(resultats.projet.hypotheses.achat, estimation.centre);

  const travaux = Number(lireChemin(projet, 'hypotheses.achat.travaux') ?? 0);
  const mobilier = Number(lireChemin(projet, 'hypotheses.achat.mobilier') ?? 0);
  const [travauxOuverts, setTravauxOuverts] = useState(travaux > 0);
  const champsTravaux = CHAMPS_TRAVAUX.filter(
    (d) => d.visibleSi === undefined || d.visibleSi(projet),
  );

  return (
    <Carte>
      <h2 className="m-0 font-display text-[22px] font-semibold">{GROUPE_ACHAT.titre}</h2>
      <div className={GRILLE}>{CHAMPS_PRINCIPAUX.map(rendre)}</div>

      <div
        role="group"
        aria-label="Négociation du prix"
        className="flex flex-col gap-2 rounded-encart border border-bordure p-2 sm:p-3"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_2fr] sm:items-end">
          {rendre(NEGOCIATION)}
          <div className="px-2 pb-2">
            {/* Au-delà du curseur (saisie au clavier jusqu'à 30 %), le pouce reste en butée mais
                la valeur affichée et annoncée reste la vraie. */}
            <Curseur
              libelle="Négociation"
              valeur={Math.min(CURSEUR_NEGOCIATION.max, pourcent)}
              min={CURSEUR_NEGOCIATION.min}
              max={CURSEUR_NEGOCIATION.max}
              pas={CURSEUR_NEGOCIATION.pas}
              formater={() => libelleNegociation(pourcent)}
              reperes={[0, 5, 10, 15]}
              formaterRepere={libelleNegociation}
              onChangement={(v) => {
                changer(NEGOCIATION, String(v));
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2">
          <p className="m-0 text-[15px] font-semibold">{phrasePrixRetenu(achat)}</p>
          {estimation !== null && vise !== null && (
            <span className="flex flex-wrap items-center gap-2 text-sm text-encre-2">
              {PHRASES_ACHAT.viser(eurosArrondis(estimation.centre))}
              <Bouton
                onClick={() => {
                  changer(NEGOCIATION, String(vise));
                }}
              >
                Viser le prix estimé
              </Bouton>
            </span>
          )}
          {estimation !== null && vise === null && (
            <p className="m-0 text-sm text-encre-2">{PHRASES_ACHAT.sousEstimation}</p>
          )}
        </div>
        <p className="m-0 px-2 text-xs text-encre-3">{PHRASES_ACHAT.negociation}</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={travauxOuverts}
          aria-controls="champs-travaux"
          onClick={() => {
            setTravauxOuverts((ouverts) => !ouverts);
          }}
          className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 hover:bg-accent-fond"
        >
          {resumeTravaux(travaux, mobilier)}
        </button>
        {travauxOuverts && (
          <div id="champs-travaux" className={GRILLE}>
            {champsTravaux.map(rendre)}
          </div>
        )}
      </div>
    </Carte>
  );
}
