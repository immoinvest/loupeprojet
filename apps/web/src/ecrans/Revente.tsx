import { useMemo, type JSX } from 'react';

import { HORIZONS, variantesRevente } from '@/analyses';
import { Carte, Ligne, Pastille, TitreCarte } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { euros, eurosSignes, pourcentage } from '@/formatage/nombres';
import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';

export function Revente(): JSX.Element {
  const { enregistre, resultats: r } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const annees = r.projet.hypotheses.revente.annees;
  const rv = r.revente;
  const pv = rv.plusValue;
  const e = r.rendement.enrichissement;
  const variantes = useMemo(
    () => variantesRevente(enregistre.projet, HORIZONS),
    [enregistre.projet],
  );

  const choisirHorizon = (horizon: number): void => {
    const application = appliquerSaisie(
      enregistre.projet,
      descripteurParChemin('hypotheses.revente.annees'),
      String(horizon),
    );
    if (application.ok) mettreAJour(enregistre.id, application.projet);
  };

  return (
    <div className="flex flex-col gap-5 px-10 pt-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[32px] leading-tight font-bold tracking-tight">
          Qu'est-ce qu'il vous restera ?
        </h1>
        <p className="m-0 max-w-[64ch] text-[17px] text-encre-2">
          Revente estimée à {pourcentage(r.projet.hypotheses.revente.evolutionAnnuelle)} par an,
          crédit remboursé, agence et impôt payés. Choisissez l'horizon.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4" role="group" aria-label="Horizon de revente">
        {variantes.map((v) => {
          const actif = v.annees === annees;
          return (
            <button
              key={v.annees}
              type="button"
              aria-pressed={actif}
              onClick={() => {
                choisirHorizon(v.annees);
              }}
              className={`flex flex-col gap-1 rounded-carte border p-5 text-left ${
                actif
                  ? 'border-accent bg-accent-fond'
                  : 'border-bordure bg-surface hover:bg-accent-fond'
              }`}
            >
              <span className="text-xs font-bold tracking-wide text-encre-3 uppercase">
                Dans {v.annees} ans
              </span>
              <span className="font-display text-[26px] leading-none font-bold">
                {euros(v.cashNetVendeur)}
              </span>
              <span className="text-sm text-encre-2">
                en poche · TRI {v.tri === null ? '—' : pourcentage(v.tri)} ·{' '}
                {eurosSignes(v.enrichissement)} d'enrichissement
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Carte>
          <TitreCarte>Revente dans {annees} ans</TitreCarte>
          <div>
            <Ligne
              libelle={`Valeur estimée (${pourcentage(r.projet.hypotheses.revente.evolutionAnnuelle)} par an)`}
              valeur={euros(rv.valeur)}
            />
            <Ligne
              libelle="Frais d'agence et diagnostics"
              valeur={eurosSignes(-rv.fraisVente.total)}
            />
            <Ligne libelle="Capital restant dû" valeur={eurosSignes(-rv.crd)} />
            <Ligne libelle="Indemnité de remboursement anticipé" valeur={eurosSignes(-rv.ira)} />
            <Ligne libelle="Impôt sur la plus-value" valeur={eurosSignes(-pv.impotTotal)} />
            <Ligne libelle="Ce qu'il vous reste en poche" valeur={euros(rv.cashNetVendeur)} fort />
          </div>
        </Carte>
        <Carte>
          <TitreCarte>Ce que ça vous aura rapporté</TitreCarte>
          <div>
            <Ligne libelle="Mise de départ" valeur={eurosSignes(-e.miseDeDepart)} />
            <Ligne
              libelle={`Cash-flows cumulés sur ${String(annees)} ans`}
              valeur={eurosSignes(e.cashflowsCumules)}
            />
            <Ligne
              libelle="Capital remboursé par les loyers"
              valeur={eurosSignes(e.capitalRembourse)}
              tonValeur="text-bon"
            />
            <Ligne
              libelle="Plus-value nette, frais et impôt déduits"
              valeur={eurosSignes(e.plusValueNette)}
            />
            <Ligne
              libelle="Enrichissement net"
              valeur={eurosSignes(e.total)}
              fort
              tonValeur={e.total >= 0 ? 'text-bon' : 'text-probleme'}
            />
            <Ligne
              libelle={`TRI sur ${String(annees)} ans`}
              valeur={r.rendement.tri === null ? '—' : pourcentage(r.rendement.tri)}
            />
          </div>
        </Carte>
      </div>

      <Carte>
        <div className="flex items-center gap-3">
          <TitreCarte>La plus-value, en détail</TitreCarte>
          {pv.plusValueBrute > 0 && pv.reintegration > 0 && (
            <Pastille ton="surveiller" compacte>
              amortissements réintégrés (réforme 2025)
            </Pastille>
          )}
        </div>
        {pv.plusValueBrute === 0 ? (
          <p className="m-0 text-[15px] text-encre-2">
            Pas de plus-value imposable : le prix de cession ({euros(pv.prixCession)}) ne dépasse
            pas le prix d'acquisition majoré ({euros(pv.prixAcquisitionMajore)}).
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-10">
            <div>
              <Ligne libelle="Prix de cession, frais déduits" valeur={euros(pv.prixCession)} />
              <Ligne libelle="Prix d'achat" valeur={euros(r.projet.hypotheses.achat.prix)} />
              <Ligne libelle="Frais d'acquisition retenus" valeur={eurosSignes(pv.fraisRetenus)} />
              <Ligne libelle="Travaux retenus" valeur={eurosSignes(pv.travauxRetenus)} />
              {pv.reintegration > 0 && (
                <Ligne
                  libelle="Amortissements réintégrés"
                  valeur={eurosSignes(-pv.reintegration)}
                />
              )}
              <Ligne libelle="Plus-value brute" valeur={euros(pv.plusValueBrute)} fort />
            </div>
            <div>
              <Ligne
                libelle={`Abattement impôt sur le revenu (${pourcentage(pv.abattements.ir, 0)})`}
                valeur={euros(pv.baseIr)}
              />
              <Ligne
                libelle={`Abattement prélèvements sociaux (${pourcentage(pv.abattements.ps, 0)})`}
                valeur={euros(pv.basePs)}
              />
              <Ligne libelle="Impôt sur le revenu, 19 %" valeur={eurosSignes(-pv.impotIr)} />
              <Ligne libelle="Prélèvements sociaux, 17,2 %" valeur={eurosSignes(-pv.impotPs)} />
              {pv.surtaxe > 0 && <Ligne libelle="Surtaxe" valeur={eurosSignes(-pv.surtaxe)} />}
              <Ligne libelle="Impôt total sur la plus-value" valeur={euros(pv.impotTotal)} fort />
            </div>
          </div>
        )}
      </Carte>
    </div>
  );
}
