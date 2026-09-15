import { VERSION_REGLES_COURANTE, obtenirRegles, type ProjetEntree } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { apportPourPart, coutTotalDuProjet } from '@/annonces/apport';
import { Curseur } from '@/composants/Curseur';
import { ChampMontant } from '@/composants/saisie/ChampMontant';
import { Compteur } from '@/composants/saisie/Compteur';
import { EchelleEnergie } from '@/composants/saisie/EchelleEnergie';
import type { IdsChamp } from '@/composants/saisie/EnveloppeChamp';
import { SaisieAnnee } from '@/composants/saisie/SaisieAnnee';
import { SaisieApport } from '@/composants/saisie/SaisieApport';
import { SaisieDuree } from '@/composants/saisie/SaisieDuree';
import { Tuiles } from '@/composants/saisie/Tuiles';
import type { Descripteur } from '@/hypotheses';
import {
  CURSEUR_NUITS,
  libelleTuile,
  texteNuits,
  type ReglageCommande,
} from '@/hypotheses/commandes';
import { choixApport } from '@/verifier/deductions';
import { periodesConstruction } from '@/verifier/periodes';

import { OUI_NON } from '../formulaire/contexte';

const PERIODES = periodesConstruction(obtenirRegles(VERSION_REGLES_COURANTE));

const CLASSE_SAISIE =
  'min-h-[44px] w-full min-w-0 rounded-encart border bg-surface px-3 text-[15px] font-semibold pointer-coarse:text-base';

export interface PropsCommande {
  readonly descripteur: Descripteur;
  readonly reglage: ReglageCommande;
  readonly ids: IdsChamp;
  /** Nom unique dans la page (chemin + id du champ) : deux offres du simulateur ont les mêmes chemins. */
  readonly nom: string;
  readonly texte: string;
  readonly onChange: (texte: string) => void;
  /** Le projet, pour les commandes qui en dépendent (apport : coût total). */
  readonly projet?: ProjetEntree | undefined;
}

/** Les nuits louées : le curseur bouge librement, la valeur s'enregistre au relâchement. */
function CurseurNuits({
  libelle,
  texte,
  onChange,
}: {
  libelle: string;
  texte: string;
  onChange: (texte: string) => void;
}): JSX.Element {
  const [brouillon, setBrouillon] = useState<number | null>(null);
  const enregistre = texte.trim() === '' ? null : Number(texte.replace(',', '.'));
  return (
    <Curseur
      libelle={libelle}
      valeur={brouillon ?? (Number.isFinite(enregistre) ? enregistre : null)}
      min={CURSEUR_NUITS.min}
      max={CURSEUR_NUITS.max}
      pas={CURSEUR_NUITS.pas}
      formater={texteNuits}
      reperes={[0, 10, 20, 30]}
      onChangement={setBrouillon}
      onValidation={(v) => {
        setBrouillon(null);
        onChange(String(v));
      }}
    />
  );
}

/** La commande d'un champ d'hypothèse, choisie par son réglage : la même que dans le formulaire Vérifier. */
export function CommandeHypothese({
  descripteur: d,
  reglage,
  ids,
  nom,
  texte,
  onChange,
  projet,
}: PropsCommande): JSX.Element {
  const { id, idLibelle, decritPar, invalide } = ids;
  switch (reglage.type) {
    case 'montant':
      return (
        <ChampMontant
          id={id}
          nom={nom}
          valeur={texte}
          onChange={onChange}
          unite={d.unite}
          decimales={reglage.decimales}
          decritPar={decritPar}
          invalide={invalide}
        />
      );
    case 'compteur': {
      const { libelleZero } = reglage;
      return (
        <Compteur
          id={id}
          nom={nom}
          valeur={texte}
          onChange={onChange}
          {...reglage.bornes}
          nomMoins={reglage.moins}
          nomPlus={reglage.plus}
          suffixe={(n) => (n === 0 && libelleZero !== undefined ? libelleZero : d.unite)}
          decritPar={decritPar}
          invalide={invalide}
        />
      );
    }
    case 'ouiNon':
    case 'tuiles':
      return (
        <Tuiles<string>
          nom={nom}
          idLibelle={idLibelle}
          decritPar={decritPar}
          options={
            d.options === undefined
              ? OUI_NON
              : d.options.map((o) => ({ valeur: o.v, libelle: libelleTuile(o.l) }))
          }
          valeur={texte}
          effacable={reglage.effacable}
          onChange={onChange}
        />
      );
    case 'energie':
      return (
        <EchelleEnergie
          nom={nom}
          variante={reglage.variante}
          idLibelle={idLibelle}
          decritPar={decritPar}
          valeur={texte}
          onChange={onChange}
        />
      );
    case 'annee':
      return (
        <SaisieAnnee
          id={id}
          nom={nom}
          nomPeriodes={`periode-${nom}`}
          idLibelle={idLibelle}
          valeur={texte}
          exacte={texte !== '' && !PERIODES.some((p) => String(p.representative) === texte)}
          periodes={PERIODES}
          onChange={(annee) => {
            onChange(annee);
          }}
        />
      );
    case 'duree':
      return (
        <SaisieDuree
          nom={nom}
          nomCompteur={`${nom}-annees`}
          idLibelle={idLibelle}
          valeur={texte}
          onChange={onChange}
          decritPar={decritPar}
          invalide={invalide}
        />
      );
    case 'apport': {
      const coutTotal = projet === undefined ? null : coutTotalDuProjet(projet);
      return (
        <SaisieApport
          id={id}
          nom={nom}
          valeur={texte}
          choix={choixApport(texte, false, coutTotal)}
          indisponibles={coutTotal === null ? ['0.1', '0.2'] : []}
          onPart={(part) => {
            if (part === '0') onChange('0');
            else if (coutTotal !== null) onChange(String(apportPourPart(coutTotal, Number(part))));
          }}
          onChange={onChange}
          decritPar={decritPar}
          invalide={invalide}
        />
      );
    }
    case 'curseur':
      return <CurseurNuits libelle={d.libelle} texte={texte} onChange={onChange} />;
    case 'taux':
    case 'texte':
      return (
        <span className="flex items-center gap-2">
          <input
            id={id}
            name={nom}
            value={texte}
            inputMode={reglage.type === 'taux' ? 'decimal' : 'text'}
            autoComplete="off"
            aria-describedby={decritPar}
            aria-invalid={invalide}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            className={`${CLASSE_SAISIE} ${invalide ? 'border-probleme' : 'border-bordure'}`}
          />
          {d.unite !== undefined && (
            <span className="text-xs whitespace-nowrap text-encre-3">{d.unite}</span>
          )}
        </span>
      );
  }
}
