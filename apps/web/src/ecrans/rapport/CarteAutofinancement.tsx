import { loyerMensuelHc, vacanceSemaines, type ResultatsComplets } from '@loupe/moteur';
import type { JSX, ReactNode } from 'react';

import { cascadeAutofinancement } from '@/analyses/rapport';
import { useModeDocument } from '@/composants/document';
import { Info } from '@/composants/info';
import { Carte, GrosChiffre, Ligne, TitreCarte } from '@/composants/ui';
import { euros, eurosSignes, nombre, pourcentage } from '@/formatage/nombres';
import {
  explicationAutofinancement,
  explicationCouverture,
  explicationEffort,
  explicationPointMort,
} from '@/textes/explications';
import { REGIMES } from '@/textes/regimes';
import { reponseCourte } from '@/textes/verdict';

const TITRE = "Est-ce que ça s'autofinance ?";

/** Un repère à côté de la cascade : libellé et icône, chiffre, précision. */
function Repere({
  libelle,
  info,
  valeur,
  precision,
  ton = '',
}: {
  libelle: string;
  info: ReactNode;
  valeur: string;
  precision: string;
  ton?: string;
}): JSX.Element {
  // Sur papier, l'explication vient sous le repère ; à l'écran, l'icône est à côté du libellé.
  const document = useModeDocument();
  return (
    <div className="flex flex-col gap-0.5 rounded-encart border border-accent-bordure bg-accent-fond px-3.5 py-3 last:odd:col-span-2 md:last:odd:col-span-1 print:last:odd:col-span-1">
      <div className="flex items-center gap-0.5 text-xs font-bold tracking-wide text-encre-3 uppercase">
        <span>{libelle}</span>
        {document ? null : info}
      </div>
      <span className={`font-display text-[26px] leading-tight font-bold ${ton}`}>{valeur}</span>
      <span className="text-[13px] text-encre-2">{precision}</span>
      {document ? info : null}
    </div>
  );
}

/** Une ligne de sous-total de la cascade : « = Après le crédit ». */
function libelleSousTotal(texte: string): JSX.Element {
  return (
    <span className="font-semibold">
      <span className="font-normal text-encre-3">= </span>
      {texte}
    </span>
  );
}

const tonSelonSigne = (valeur: number): string => (valeur < 0 ? 'text-probleme' : 'text-bon');

function Cascade({ r }: { r: ResultatsComplets }): JSX.Element {
  const c = cascadeAutofinancement(r);
  const { location } = r.projet.hypotheses;
  const annees = String(r.projet.hypotheses.revente.annees);
  return (
    <div>
      <Ligne libelle="Loyer" valeur={eurosSignes(c.loyer)} tonValeur="font-bold text-bon" />
      {c.recuperees > 0 && (
        <Ligne
          libelle="Forfaits de charges et ménage facturés"
          valeur={eurosSignes(c.recuperees)}
          tonValeur="text-bon"
        />
      )}
      <Ligne libelle="Crédit et assurance" valeur={eurosSignes(-c.credit)} />
      <Ligne
        libelle={libelleSousTotal('Après le crédit')}
        valeur={eurosSignes(c.apresCredit)}
        tonValeur={`font-semibold ${tonSelonSigne(c.apresCredit)}`}
      />
      <Ligne libelle="Charges, impôts locaux, entretien" valeur={eurosSignes(-c.charges)} />
      {/* En courte durée, les nuits louées portent déjà la vacance ; les frais sont dans les charges. */}
      {location.mode !== 'courte_duree' && (
        <Ligne
          libelle={`${nombre(vacanceSemaines(location))} semaines vides par an`}
          valeur={eurosSignes(-c.vacance)}
        />
      )}
      <Ligne
        libelle="Reste chaque mois"
        valeur={eurosSignes(c.apresCharges)}
        fort
        tonValeur={tonSelonSigne(c.apresCharges)}
      />
      <Ligne
        libelle={
          <span className="flex flex-col">
            Impôt
            <span className="text-xs text-encre-3">
              {REGIMES[r.fiscalite.retenu]}, moyenne sur {annees} ans
            </span>
          </span>
        }
        valeur={eurosSignes(-c.impot)}
      />
      <Ligne
        libelle={libelleSousTotal("Après l'impôt")}
        valeur={eurosSignes(c.apresImpot)}
        tonValeur={`font-semibold ${tonSelonSigne(c.apresImpot)}`}
      />
    </div>
  );
}

function Reperes({ r }: { r: ResultatsComplets }): JSX.Element {
  const c = r.cashflow;
  // Loyer mensuel équivalent : total des chambres en colocation, nuitées × nuitée en courte durée.
  const loyerHc = loyerMensuelHc(r.projet.hypotheses.location);
  const mensualite = r.financement.mensualiteTotale;
  return (
    <div className="grid grid-cols-2 content-start gap-2.5 md:grid-cols-1 print:grid-cols-1">
      {c.tauxCouverture !== null && (
        <Repere
          libelle="Part du loyer prise par le crédit"
          info={<Info sujet="Part du loyer prise par le crédit" texte={explicationCouverture(r)} />}
          valeur={pourcentage(c.tauxCouverture, 0)}
          precision={`${euros(mensualite)} de mensualité pour ${euros(loyerHc)} de loyer`}
          ton={c.tauxCouverture > 1 ? 'text-probleme' : ''}
        />
      )}
      {c.mensuel < 0 ? (
        <Repere
          libelle="Effort d'épargne"
          info={<Info sujet="Effort d'épargne" texte={explicationEffort(r)} />}
          valeur={`${euros(c.effortEpargne)}/mois`}
          precision="à sortir de votre poche"
          ton="text-probleme"
        />
      ) : (
        <Repere
          libelle="Excédent"
          info={<Info sujet="Excédent" texte={explicationEffort(r)} />}
          valeur={`${euros(c.mensuel)}/mois`}
          precision="dans votre poche, avant impôt"
          ton="text-bon"
        />
      )}
      {c.pointMort !== null && (
        <Repere
          libelle="Loyer d'équilibre"
          info={<Info sujet="Loyer d'équilibre" texte={explicationPointMort(r)} />}
          valeur={euros(c.pointMort)}
          precision={`pour un cash-flow à zéro (${euros(loyerHc)} visés)`}
        />
      )}
    </div>
  );
}

/** La carte principale du Rapport : la cascade du loyer au reste après impôt, et ses repères. */
export function CarteAutofinancement({ r }: { r: ResultatsComplets }): JSX.Element {
  const cf = r.cashflow.mensuel;
  const ton = cf >= 0 ? 'bon' : cf >= -100 ? 'surveiller' : 'probleme';
  const reponse = cf >= 0 ? 'oui' : cf >= -100 ? 'presque' : 'non';
  return (
    <Carte className="border-accent-bordure">
      <TitreCarte info={<Info sujet={TITRE} texte={explicationAutofinancement(r)} />}>
        {TITRE}
      </TitreCarte>
      <GrosChiffre ton={ton}>{reponseCourte(reponse)}</GrosChiffre>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,3fr)_minmax(220px,2fr)] md:gap-8 print:grid-cols-[minmax(0,3fr)_minmax(220px,2fr)] print:gap-8">
        <Cascade r={r} />
        <Reperes r={r} />
      </div>
    </Carte>
  );
}
