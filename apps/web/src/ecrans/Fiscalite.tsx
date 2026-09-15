import type { Regime } from '@loupe/moteur';
import type { JSX } from 'react';
import { Link } from 'react-router';

import { useModeDocument } from '@/composants/document';
import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';
import { manquesBloquants, TEXTES_TRANCHE } from '@/textes/manques';
import { ORDRE_REGIMES, REGIMES, impotDuAuxAmortissements } from '@/textes/regimes';

import { CarteRegime } from './fiscalite/CarteRegime';
import { Frise } from './fiscalite/Frise';
import { ImpotsEmpiles } from './fiscalite/ImpotsEmpiles';
import { TableauAnnees } from './fiscalite/TableauAnnees';
import { TableauRevente } from './fiscalite/TableauRevente';
import { ChampHypothese } from './hypotheses/ChampHypothese';
import { AnalyseIncomplete } from './projet/AnalyseIncomplete';

const TITRE = "Combien d'impôts, selon le régime ?";

export function Fiscalite(): JSX.Element {
  const { enregistre, resultats: r } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const document = useModeDocument();
  const annees = r.projet.hypotheses.revente.annees;

  const retenir = (regime: Regime): void => {
    const application = appliquerSaisie(
      enregistre.projet,
      descripteurParChemin('hypotheses.fiscalite.regime'),
      regime,
    );
    if (application.ok) mettreAJour(enregistre.id, application.projet);
  };

  if (!r.complet) {
    return (
      <Page>
        <TitrePage taille="volet">{TITRE}</TitrePage>
        {manquesBloquants(r.manques).map((m) => (
          <AnalyseIncomplete key={m.code} manque={m} />
        ))}
      </Page>
    );
  }

  const f = r.fiscalite;
  const retenu = f.regimes[f.retenu];
  const meuble = f.retenu === 'micro_bic' || f.retenu === 'lmnp_reel';
  const trancheEstimee = r.projet.provenance['fiscalite.tmi'] === 'estime';
  const descripteurTmi = descripteurParChemin('hypotheses.fiscalite.tmi');
  const psAConfirmer = meuble && r.meta.aConfirmer.includes('fiscalite.prelevementsSociaux.bic');
  const impotAmortissements = impotDuAuxAmortissements(f);
  // Seuls les régimes qui ont un sens pour ce type de location : les deux du meublé en colocation,
  // courte et moyenne durée ; les quatre en location nue ou meublée.
  const affiches = ORDRE_REGIMES.filter((regime) => f.compatibles.includes(regime));
  const regimesAffiches = affiches.map((regime) => f.regimes[regime]);

  return (
    <Page>
      <TitrePage taille="volet">{TITRE}</TitrePage>

      {trancheEstimee && !document && (
        <Carte className="border-accent-bordure bg-accent-fond">
          <h2 className="m-0 font-display text-[22px] font-semibold">{TEXTES_TRANCHE.titre}</h2>
          <p className="m-0 text-[15px] text-encre-2">{TEXTES_TRANCHE.phrase}</p>
          <div className="sm:w-[320px] sm:max-w-full">
            <ChampHypothese
              descripteur={descripteurTmi}
              texte={String(r.projet.hypotheses.fiscalite.tmi)}
              badge={{ ton: 'surveiller', libelle: 'estimé' }}
              onChange={(texte) => {
                const application = appliquerSaisie(enregistre.projet, descripteurTmi, texte);
                if (application.ok) mettreAJour(enregistre.id, application.projet);
              }}
            />
          </div>
        </Carte>
      )}

      <p className="m-0 flex flex-wrap items-center gap-x-3 text-[15px] text-encre-2">
        <span>
          Pendant la location, puis à la revente dans <strong>{annees} ans</strong>.
        </span>
        {!document && (
          <Link
            to="../revente"
            relative="path"
            className="inline-flex min-h-11 items-center font-bold no-underline survol-texte"
          >
            Changer l'horizon
          </Link>
        )}
      </p>

      {/* Une colonne sur téléphone, deux à partir de 640 px et sur papier, quatre à l'écran à partir de 1 280 px. */}
      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${document ? 'print:grid-cols-2' : 'xl:grid-cols-4'}`}
      >
        {affiches.map((regime) => (
          <CarteRegime
            key={regime}
            r={f.regimes[regime]}
            annees={annees}
            retenu={regime === f.retenu}
            meilleurCashflow={regime === f.meilleur}
            meilleurTotal={regime === f.meilleurAuTotal}
            impotAmortissements={regime === 'lmnp_reel' ? impotAmortissements : 0}
            onRetenir={() => {
              retenir(regime);
            }}
          />
        ))}
      </div>
      <p className="m-0 text-[13px] text-encre-3">
        « Le plus avantageux au total » : le régime qui laisse le plus d'argent à la fin avec ces
        hypothèses (cash-flow après impôt et vente nette). Un repère, pas un conseil.
      </p>

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">
          Pendant la location et à la revente
        </h2>
        <ImpotsEmpiles regimes={regimesAffiches} annees={annees} />
      </Carte>

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">
          Quand commencez-vous à payer, en {REGIMES[f.retenu].toLowerCase()} ?
        </h2>
        <Frise annees={retenu.annees} impotRevente={retenu.impotRevente} />
        <p className="m-0 text-[15px] text-encre-2">
          {retenu.premiereAnneeImposable === null
            ? `Pas avant l'année ${String(annees + 1)} avec ces hypothèses.`
            : `Premier impôt l'année ${String(retenu.premiereAnneeImposable)}.`}
          {psAConfirmer
            ? ' Prélèvements sociaux du meublé à 18,6 % (loi de financement 2026), taux à confirmer.'
            : ''}
        </p>
      </Carte>

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">La revente selon le régime</h2>
        <TableauRevente regimes={regimesAffiches} />
      </Carte>

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">Année par année</h2>
        <TableauAnnees annees={retenu.annees} />
      </Carte>
    </Page>
  );
}
