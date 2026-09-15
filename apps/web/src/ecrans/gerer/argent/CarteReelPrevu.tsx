import {
  argentDesDerniersMois,
  comparerReelPrevu,
  jourLocal,
  moisDeComparaison,
  prevuDuBien,
  reelMensuel,
  type BienGere,
  type EtatGestion,
} from '@loupe/gestion';
import type { JSX } from 'react';
import { Link } from 'react-router';

import { Carte, Ligne, TitreCarte } from '@/composants/ui';
import { useArgent } from '@/gestion/argent/ArgentContext';
import { donneesArgent } from '@/gestion/argent/page';
import { etatAnalyserBien } from '@/gestion/declaration/analyser';
import { montantSigne } from '@/textes/gerer-argent';
import {
  explicationReelPrevu,
  phraseEcart,
  RAISONS_SANS_PREVU,
  TEXTES_REEL_PREVU as T,
  titreEcart,
} from '@/textes/gerer-declaration';

import { EtatArgentAbsent } from './AttenteArgent';

const CLASSE_LIEN_BOUTON =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 no-underline survol-fond';

/**
 * « Réel contre prévu », sur la fiche d'un bien (G5-2) : ce que l'analyse promettait, recalculé par le
 * moteur, contre la moyenne réelle des derniers mois complets, et les deux postes qui font l'écart.
 */
export function CarteReelPrevu({
  bien,
  donnees,
}: {
  readonly bien: BienGere;
  readonly donnees: EtatGestion;
}): JSX.Element {
  const argent = useArgent();
  const prevu = prevuDuBien(bien);

  if (!prevu.ok && prevu.raison === 'sans_analyse') {
    return (
      <Carte>
        <TitreCarte>{T.titre}</TitreCarte>
        <p className="m-0 text-sm text-encre-2">{T.sansAnalyse}</p>
        {bien.type !== 'parking' && (
          <div>
            <Link
              to="/projets/nouveau"
              state={etatAnalyserBien(bien)}
              className={CLASSE_LIEN_BOUTON}
            >
              {T.analyser}
            </Link>
          </div>
        )}
      </Carte>
    );
  }

  let contenu: JSX.Element;
  if (!prevu.ok) {
    contenu = <p className="m-0 text-sm text-encre-2">{RAISONS_SANS_PREVU[prevu.raison]}</p>;
  } else if (argent.donnees === null) {
    contenu = <EtatArgentAbsent />;
  } else {
    const periode = moisDeComparaison(bien, jourLocal(new Date()));
    if (periode === null) {
      contenu = <p className="m-0 text-sm text-encre-2">{T.tropTot}</p>;
    } else {
      const bilan = argentDesDerniersMois(
        donneesArgent(donnees, argent.donnees),
        periode.fin,
        { bienId: bien.id },
        periode.mois,
      );
      const { ecart, reel, principaux } = comparerReelPrevu(
        prevu,
        reelMensuel(bilan, periode.mois),
      );
      contenu = (
        <>
          <p
            className={`m-0 font-display text-xl font-bold ${
              ecart <= -100 ? 'text-probleme-texte' : ecart >= 100 ? 'text-bon-texte' : 'text-encre'
            }`}
          >
            {titreEcart(ecart)}
          </p>
          <div>
            <Ligne libelle={`${T.cashflow} · ${T.prevu}`} valeur={montantSigne(prevu.cashflow)} />
            <Ligne
              libelle={`${T.cashflow} · ${T.reel}`}
              valeur={montantSigne(reel.cashflow)}
              fort
            />
          </div>
          {principaux.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-xs font-bold tracking-wider text-encre-3 uppercase">
                {T.principaux}
              </h3>
              <ul
                aria-label={T.principaux}
                className="m-0 flex list-none flex-col gap-1 p-0 text-sm"
              >
                {principaux.map((e) => (
                  <li key={e.poste}>{phraseEcart(e)}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="m-0 text-sm text-encre-3">
            {explicationReelPrevu(periode.mois, prevu.versionRegles)}
          </p>
        </>
      );
    }
  }

  return (
    <Carte>
      <TitreCarte>{T.titre}</TitreCarte>
      {contenu}
    </Carte>
  );
}
