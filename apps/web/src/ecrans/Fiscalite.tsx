import type { AnneeFiscale, Regime, ResultatRegime } from '@loupe/moteur';
import type { JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { euros, eurosSignes, pourcentage } from '@/formatage/nombres';
import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';
import { MODES, ORDRE_REGIMES, REGIMES, explicationRegime } from '@/textes/regimes';

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
      <p className="m-0 text-sm text-encre-3">
        Loyer {euros(r.cashflow.recettes.loyersBruts / 12)} par mois, {MODES[r.mode]}.
      </p>
      <div className="font-display text-[32px] leading-none font-bold">
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
  const f = r.fiscalite;
  const annees = r.projet.hypotheses.revente.annees;
  const retenu = f.regimes[f.retenu];
  const meuble = f.retenu === 'micro_bic' || f.retenu === 'lmnp_reel';
  const psAConfirmer = meuble && r.meta.aConfirmer.includes('fiscalite.prelevementsSociaux.bic');

  const retenir = (regime: Regime): void => {
    const application = appliquerSaisie(
      enregistre.projet,
      descripteurParChemin('hypotheses.fiscalite.regime'),
      regime,
    );
    if (application.ok) mettreAJour(enregistre.id, application.projet);
  };

  return (
    <div className="flex flex-col gap-5 px-10 pt-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[32px] leading-tight font-bold tracking-tight">
          Combien d'impôts, selon le régime ?
        </h1>
        <p className="m-0 max-w-[64ch] text-[17px] text-encre-2">
          Les quatre régimes avec votre tranche à{' '}
          {pourcentage(r.projet.hypotheses.fiscalite.tmi, 0)}, projetés sur {annees} ans. Le régime
          retenu alimente le rapport ; changez-le ici.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {ORDRE_REGIMES.map((regime) => (
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
                <th className="py-2 pr-3 font-semibold">Année</th>
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
                  <td className="py-2 pr-3 font-semibold">{a.annee}</td>
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
    </div>
  );
}
