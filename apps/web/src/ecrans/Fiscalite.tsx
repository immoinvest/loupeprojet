import type { AnneeFiscale, Regime, ResultatRegime } from '@loupe/moteur';
import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { euros, eurosSignes } from '@/formatage/nombres';
import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';
import { manquesBloquants, TEXTES_TRANCHE } from '@/textes/manques';
import { ORDRE_REGIMES, REGIMES, explicationRegime } from '@/textes/regimes';

import { ChampHypothese } from './hypotheses/ChampHypothese';
import { AnalyseIncomplete } from './projet/AnalyseIncomplete';

const TITRE = "Combien d'impôts, selon le régime ?";

function CarteRegime({
  r,
  annees,
  retenu,
  meilleur,
  onRetenir,
}: {
  r: ResultatRegime;
  annees: number;
  retenu: boolean;
  meilleur: boolean;
  onRetenir: () => void;
}): JSX.Element {
  return (
    <Carte className={retenu ? 'border-accent bg-accent-fond' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="m-0 font-display text-lg font-semibold">{REGIMES[r.regime]}</h2>
        {retenu && (
          <Pastille ton="accent" compacte>
            retenu
          </Pastille>
        )}
        {meilleur && (
          <Pastille ton="bon" compacte>
            meilleur cash-flow
          </Pastille>
        )}
        {!r.eligible && (
          <Pastille ton="probleme" compacte>
            plafond dépassé
          </Pastille>
        )}
      </div>
      <div className="font-display text-[28px] leading-none font-bold sm:text-[32px] print:text-[32px]">
        {euros(r.impotTotal)}
        <span className="ml-2 text-base font-semibold text-encre-3">d'impôt sur {annees} ans</span>
      </div>
      <p className="m-0 text-sm text-encre-2">
        Cash-flow après impôt cumulé : <strong>{eurosSignes(r.cashflowApresImpotTotal)}</strong>
      </p>
      <p className="m-0 border-t border-bordure-douce pt-2 text-[13px] leading-snug text-encre-2">
        {explicationRegime(r, annees)}
      </p>
      {!retenu && r.eligible && <Bouton onClick={onRetenir}>Retenir ce régime</Bouton>}
    </Carte>
  );
}

function Frise({ annees }: { annees: readonly AnneeFiscale[] }): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${String(annees.length)}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${String(annees.filter((a) => a.impot > 0).length)} années imposées sur ${String(annees.length)}`}
      >
        {annees.map((a) => (
          <div
            key={a.annee}
            title={`Année ${String(a.annee)} : ${euros(a.impot)}`}
            className={`h-6 rounded-[4px] border ${
              a.impot > 0 ? 'border-surveiller/50 bg-surveiller-fond' : 'border-bon/40 bg-bon-fond'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-encre-3">
        <span>année 1</span>
        <span>année {annees.length}</span>
      </div>
    </div>
  );
}

const COLONNES: readonly {
  readonly titre: string;
  readonly valeur: (a: AnneeFiscale) => string;
}[] = [
  { titre: 'Recettes', valeur: (a) => euros(a.recettes) },
  { titre: 'Charges déductibles', valeur: (a) => euros(a.chargesDeductibles) },
  { titre: 'Intérêts', valeur: (a) => euros(a.interetsDeductibles) },
  { titre: 'Amortissements déduits', valeur: (a) => euros(a.amortissementsDeduits) },
  {
    titre: 'Déficits imputés',
    valeur: (a) => euros(a.deficitImpute + a.deficitImputeRevenuGlobal),
  },
  { titre: 'Base imposable', valeur: (a) => euros(a.baseImposable) },
  { titre: 'Impôt', valeur: (a) => euros(a.impot) },
  { titre: 'Cash-flow après impôt', valeur: (a) => eurosSignes(a.cashflowApresImpot) },
];

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
  // Seuls les régimes qui ont un sens pour ce type de location : les deux du meublé en colocation,
  // courte et moyenne durée ; les quatre en location nue ou meublée.
  const affiches = ORDRE_REGIMES.filter((regime) => f.compatibles.includes(regime));

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
            meilleur={regime === f.meilleur}
            onRetenir={() => {
              retenir(regime);
            }}
          />
        ))}
      </div>

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">
          Quand commencez-vous à payer, en {REGIMES[f.retenu].toLowerCase()} ?
        </h2>
        <Frise annees={retenu.annees} />
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
        <h2 className="m-0 font-display text-[22px] font-semibold">Année par année</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-encre-3">
                <th className="sticky left-0 bg-surface py-2 pr-3 font-semibold">Année</th>
                {COLONNES.map((c) => (
                  <th key={c.titre} className="py-2 pr-3 text-right font-semibold">
                    {c.titre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {retenu.annees.map((a) => (
                <tr key={a.annee} className="border-t border-bordure-douce">
                  <td className="sticky left-0 bg-surface py-2 pr-3 font-semibold">{a.annee}</td>
                  {COLONNES.map((c) => (
                    <td key={c.titre} className="py-2 pr-3 text-right">
                      {c.valeur(a)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>
    </Page>
  );
}
