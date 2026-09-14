import type { Resultats } from '@loupe/moteur';
import type { JSX } from 'react';

import { Info } from '@/composants/info';
import { Carte, GrosChiffre, Ligne, Pastille, TitreCarte } from '@/composants/ui';
import { euros, eurosSignes, pourcentage } from '@/formatage/nombres';
import { EXPLICATIONS } from '@/textes/explications';
import { TEXTES_FINANCEMENT as T, phraseCouverture } from '@/textes/financement';

const taux = (valeur: number | null): string => (valeur === null ? '—' : pourcentage(valeur, 2));

/** Mensualité, TAEG et coût complet du crédit. */
export function CarteCout({ r }: { r: Resultats }): JSX.Element {
  const f = r.financement;
  const { pret } = r.projet.hypotheses;
  const fraisBancaires = pret.fraisDossier + pret.fraisGarantie;
  return (
    <Carte>
      <TitreCarte info={<Info sujet={T.cout} texte={EXPLICATIONS.financement} />}>
        {T.cout}
      </TitreCarte>
      {f.montantEmprunte > 0 ? (
        <GrosChiffre complement="par mois, assurance comprise">
          {euros(f.mensualiteTotale)}
        </GrosChiffre>
      ) : (
        <p className="m-0 text-[15px] text-encre-2">{T.sansEmprunt}</p>
      )}
      <div>
        <Ligne libelle="Emprunté" valeur={euros(f.montantEmprunte)} />
        <Ligne libelle="Mensualité hors assurance" valeur={euros(f.mensualiteHorsAssurance)} />
        <Ligne libelle="Assurance emprunteur" valeur={euros(f.assuranceMensuelle)} />
        <Ligne libelle="TAEG hors assurance" valeur={taux(f.taegHorsAssurance)} />
        <Ligne
          libelle={
            <span className="inline-flex flex-wrap items-center gap-2">
              TAEG assurance comprise
              {f.tauxUsureDepasse && (
                <Pastille ton="probleme" compacte>
                  {T.usure}
                </Pastille>
              )}
            </span>
          }
          valeur={taux(f.taegAvecAssurance)}
          tonValeur={f.tauxUsureDepasse ? 'text-probleme' : ''}
        />
        <Ligne libelle="Intérêts sur toute la durée" valeur={euros(f.totalInterets)} />
        <Ligne libelle="Assurance sur toute la durée" valeur={euros(f.totalAssurance)} />
        <Ligne libelle="Frais de dossier et garantie" valeur={euros(fraisBancaires)} />
        <Ligne libelle="Coût total du crédit" valeur={euros(f.coutTotalCredit)} fort />
      </div>
    </Carte>
  );
}

/** Coût total du projet, mise de départ et emprunt. */
export function CarteOrigine({ r }: { r: Resultats }): JSX.Element {
  const f = r.financement;
  const { achat, pret } = r.projet.hypotheses;
  return (
    <Carte>
      <TitreCarte>{T.origine}</TitreCarte>
      <div>
        <Ligne libelle="Prix affiché" valeur={euros(achat.prix)} />
        {achat.travaux > 0 && <Ligne libelle="Travaux" valeur={euros(achat.travaux)} />}
        <Ligne
          libelle="Frais d'acquisition (droits, notaire)"
          valeur={euros(f.fraisAcquisition.total)}
        />
        <Ligne
          libelle="Frais de dossier et garantie"
          valeur={euros(pret.fraisDossier + pret.fraisGarantie)}
        />
        {achat.mobilier > 0 && (
          <Ligne libelle="Mobilier, payé comptant" valeur={euros(achat.mobilier)} />
        )}
        <Ligne libelle="Coût total du projet" valeur={euros(f.coutTotalProjet)} fort />
        <Ligne libelle="Vous apportez (apport et mobilier)" valeur={euros(f.miseDeDepart)} />
        <Ligne
          libelle="La banque prête"
          valeur={euros(f.montantEmprunte)}
          fort
          tonValeur="text-accent"
        />
      </div>
    </Carte>
  );
}

/** Le feu couverture : mensualité assurance comprise ÷ loyer hors charges. */
export function CarteCouverture({ r }: { r: Resultats }): JSX.Element {
  const f = r.financement;
  const feu = r.verdict.feux.find((x) => x.axe === 'couverture');
  const etat = feu?.feu ?? 'inconnu';
  const valeur = feu?.valeur ?? null;
  const loyer = r.cashflow.recettes.loyersBruts / 12;
  const ton =
    etat === 'bon'
      ? 'bon'
      : etat === 'surveiller'
        ? 'surveiller'
        : etat === 'probleme'
          ? 'probleme'
          : 'encre';
  return (
    <Carte>
      <TitreCarte info={<Info sujet={T.couverture} texte={EXPLICATIONS.couverture} />}>
        {T.couverture}
      </TitreCarte>
      <GrosChiffre
        ton={ton}
        complement={valeur === null ? 'pas de loyer' : 'du loyer part dans le crédit'}
      >
        {valeur === null ? '—' : pourcentage(valeur, 0)}
      </GrosChiffre>
      <p className="m-0 text-[15px] leading-relaxed text-encre-2">{phraseCouverture(etat)}</p>
      <div>
        <Ligne libelle="Loyer hors charges" valeur={euros(loyer)} />
        <Ligne libelle="Crédit et assurance" valeur={eurosSignes(-f.mensualiteTotale)} />
        <Ligne
          libelle="Reste pour les charges et pour vous"
          valeur={eurosSignes(loyer - f.mensualiteTotale)}
          fort
          tonValeur={loyer - f.mensualiteTotale >= 0 ? 'text-bon' : 'text-probleme'}
        />
        {f.effort.hcsf !== null && (
          <Ligne
            libelle={
              <span className="inline-flex flex-wrap items-center gap-2">
                {T.effortAncien}
                {f.effort.depasseHcsf && (
                  <Pastille ton="probleme" compacte>
                    {T.effortDepasse(pourcentage(f.effort.seuil, 0))}
                  </Pastille>
                )}
              </span>
            }
            valeur={pourcentage(f.effort.hcsf, 0)}
          />
        )}
      </div>
      {f.effort.depasseDuree && (
        <Pastille ton="surveiller" compacte>
          {T.dureeMax(f.effort.dureeMaxAnnees)}
        </Pastille>
      )}
    </Carte>
  );
}
