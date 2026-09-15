import { calculerProjet } from '@loupe/moteur';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import { HORIZONS, projetAHorizon, variantesRevente } from '@/analyses';
import { useModeDocument } from '@/composants/document';
import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, Ligne, Pastille, TitreCarte } from '@/composants/ui';
import { ValeurHypothese } from '@/composants/ValeurHypothese';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { euros, eurosSignes, pourcentage } from '@/formatage/nombres';
import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';
import { manquesBloquants } from '@/textes/manques';
import { PRECISION_VALORISATION, TEXTES_PRIX_VENTE, aidePrixVente } from '@/textes/revente';

import { useSaisieHypotheses } from './hypotheses/GrilleHypotheses';
import { AnalyseIncomplete } from './projet/AnalyseIncomplete';
import { BandeauHorizons, CarteHorizon } from './revente/Horizon';

const TITRE = "Qu'est-ce qu'il vous restera ?";

/** Sans relâchement reçu, l'horizon est enregistré après ce délai sans mouvement. */
export const DELAI_ENREGISTREMENT_MS = 150;

export function Revente(): JSX.Element {
  const { enregistre, resultats } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const saisie = useSaisieHypotheses();
  const document = useModeDocument();
  const projet = enregistre.projet;
  const annees = resultats.projet.hypotheses.revente.annees;

  // Pendant le glissement, l'horizon vit ici ; le projet n'est écrit qu'au relâchement.
  const [brouillon, setBrouillon] = useState<number | null>(null);
  const horizon = brouillon ?? annees;

  // Chiffres en direct : recalcul sans scénarios (≈ 5 ms) ; au repos, les résultats du projet.
  const r = useMemo(
    () =>
      brouillon === null || brouillon === annees
        ? resultats
        : calculerProjet(projetAHorizon(projet, brouillon), { avecScenarios: false }),
    [brouillon, annees, resultats, projet],
  );
  const variantes = useMemo(() => variantesRevente(projet, HORIZONS), [projet]);

  const enregistrer = useCallback(
    (choisi: number): void => {
      setBrouillon(null);
      if (choisi === annees) return;
      const application = appliquerSaisie(
        projet,
        descripteurParChemin('hypotheses.revente.annees'),
        String(choisi),
      );
      if (application.ok) mettreAJour(enregistre.id, application.projet);
    },
    [annees, projet, enregistre.id, mettreAJour],
  );

  useEffect(() => {
    if (brouillon === null) return;
    const minuteur = setTimeout(() => {
      enregistrer(brouillon);
    }, DELAI_ENREGISTREMENT_MS);
    return () => {
      clearTimeout(minuteur);
    };
  }, [brouillon, enregistrer]);

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

  const rv = r.revente;
  const pv = rv.plusValue;
  const e = r.rendement.enrichissement;
  const valorisation = rv.valorisationTravaux;
  const champPrixVente = {
    ...descripteurParChemin('hypotheses.revente.prixVente'),
    aide: aidePrixVente(rv.valeurSaisie, rv.valeurEstimee),
  };

  return (
    <Page>
      <TitrePage taille="volet">{TITRE}</TitrePage>

      <CarteHorizon
        horizon={horizon}
        versionRegles={resultats.projet.versionRegles}
        onChangement={setBrouillon}
        onValidation={enregistrer}
      />

      <BandeauHorizons variantes={variantes} horizon={horizon} onChoix={enregistrer} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 print:grid-cols-2">
        <Carte>
          <TitreCarte>Revente dans {horizon} ans</TitreCarte>
          <div>
            <Ligne
              libelle={
                rv.valeurSaisie ? (
                  TEXTES_PRIX_VENTE.saisi
                ) : (
                  <>
                    {TEXTES_PRIX_VENTE.estime} (
                    <ValeurHypothese chemin="hypotheses.revente.evolutionAnnuelle">
                      {`${pourcentage(r.projet.hypotheses.revente.evolutionAnnuelle)} par an`}
                    </ValeurHypothese>
                    )
                  </>
                )
              }
              valeur={euros(rv.valeur)}
            />
            {!rv.valeurSaisie && valorisation.methode !== 'aucune' && valorisation.montant > 0 && (
              <Ligne
                libelle={
                  <>
                    dont valeur ajoutée par les{' '}
                    <ValeurHypothese chemin="hypotheses.achat.travaux">travaux</ValeurHypothese> (
                    {PRECISION_VALORISATION[valorisation.methode]}), au prix d'aujourd'hui
                  </>
                }
                valeur={eurosSignes(valorisation.montant)}
              />
            )}
            <Ligne
              libelle={
                <ValeurHypothese chemin="hypotheses.revente.fraisAgenceTaux">
                  Frais d'agence et diagnostics
                </ValeurHypothese>
              }
              valeur={eurosSignes(-rv.fraisVente.total)}
            />
            <Ligne libelle="Capital restant dû" valeur={eurosSignes(-rv.crd)} />
            <Ligne libelle="Indemnité de remboursement anticipé" valeur={eurosSignes(-rv.ira)} />
            <Ligne libelle="Impôt sur la plus-value" valeur={eurosSignes(-pv.impotTotal)} />
            <Ligne libelle="Ce qu'il vous reste en poche" valeur={euros(rv.cashNetVendeur)} fort />
          </div>
          {!document && (
            <div className="flex flex-col gap-1">
              {saisie.rendre(champPrixVente)}
              {rv.valeurSaisie && (
                <button
                  type="button"
                  onClick={() => {
                    saisie.changer(champPrixVente, '');
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 self-start px-2 text-[15px] font-bold text-accent survol-texte"
                >
                  {TEXTES_PRIX_VENTE.revenir}
                </button>
              )}
            </div>
          )}
        </Carte>
        <Carte>
          <TitreCarte>Ce que ça vous aura rapporté</TitreCarte>
          <div>
            <Ligne libelle="Mise de départ" valeur={eurosSignes(-e.miseDeDepart)} />
            <Ligne
              libelle={`Cash-flows cumulés sur ${String(horizon)} ans`}
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
              libelle={`TRI sur ${String(horizon)} ans`}
              valeur={r.rendement.tri === null ? '—' : pourcentage(r.rendement.tri)}
            />
          </div>
        </Carte>
      </div>

      <Carte>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
          <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10 print:grid-cols-2 print:gap-x-10">
            <div>
              <Ligne libelle="Prix de cession, frais déduits" valeur={euros(pv.prixCession)} />
              <Ligne
                libelle="Prix d'achat"
                valeur={
                  <ValeurHypothese chemin="hypotheses.achat.prix">
                    {euros(r.achat.prixRetenu)}
                  </ValeurHypothese>
                }
              />
              <Ligne libelle="Frais d'acquisition retenus" valeur={eurosSignes(pv.fraisRetenus)} />
              <Ligne
                libelle="Travaux retenus"
                valeur={
                  <ValeurHypothese chemin="hypotheses.achat.travaux">
                    {eurosSignes(pv.travauxRetenus)}
                  </ValeurHypothese>
                }
              />
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
    </Page>
  );
}
