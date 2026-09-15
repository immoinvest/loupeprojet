import {
  motifReduitUtile,
  preavisLocataire,
  type ContextePreavis,
  type CongeSaisie,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import {
  congeRecalcule,
  lireConge,
  saisieCongeInitiale,
  type ChampConge,
  type SaisieConge,
} from '@/gestion/fin-bail/saisie';
import { preavisEnLettres, TEXTES_FIN_BAIL, TEXTES_PREAVIS as T } from '@/textes/gerer-fin-bail';

import { ChampGerer } from '../ChampGerer';

export interface PreavisProps {
  /** Identifiant unique dans la page (une fiche montre plusieurs locations). */
  readonly id: string;
  readonly contexte: Omit<ContextePreavis, 'reduit'>;
  readonly aujourdhui: string;
  /** Le congé déjà enregistré, quand on le modifie. */
  readonly initiale?: SaisieConge | undefined;
  readonly occupe: boolean;
  readonly erreur: string | null;
  readonly onEnregistrer: (conge: CongeSaisie) => Promise<void>;
  readonly onFermer: () => void;
}

/**
 * « Julie part » (clic 1) ouvre ce formulaire ; « Enregistrer le congé » (clic 2). Deklic calcule la
 * sortie depuis la date de réception (art. 15, 25-8) ; le bailleur peut la corriger.
 */
export function Preavis({
  id,
  contexte,
  aujourdhui,
  initiale,
  occupe,
  erreur,
  onEnregistrer,
  onFermer,
}: PreavisProps): JSX.Element {
  const [saisie, setSaisie] = useState<SaisieConge>(
    () => initiale ?? saisieCongeInitiale({ ...contexte, reduit: false }, aujourdhui),
  );
  const [erreurs, setErreurs] = useState<readonly ChampConge[]>([]);
  const preavis = preavisLocataire({ ...contexte, reduit: saisie.reduit });
  const motifUtile = motifReduitUtile(contexte);

  const changer = (suivante: SaisieConge, recalculer: boolean): void => {
    setSaisie(recalculer ? congeRecalcule(suivante, contexte) : suivante);
  };

  return (
    <form
      noValidate
      aria-label={T.formulaire}
      className="flex flex-col gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const lu = lireConge(saisie);
        if (!lu.ok) {
          setErreurs(lu.erreurs);
          document.getElementById(`${id}-${lu.erreurs[0] ?? 'recuLe'}`)?.focus();
          return;
        }
        setErreurs([]);
        void onEnregistrer(lu.conge);
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <ChampGerer
            id={`${id}-recuLe`}
            libelle={T.recuLe}
            type="date"
            valeur={saisie.recuLe}
            onChange={(recuLe) => {
              changer({ ...saisie, recuLe }, true);
            }}
            erreur={erreurs.includes('recuLe') ? T.erreurRecuLe : undefined}
            aide={T.aideRecuLe}
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <ChampGerer
            id={`${id}-fin`}
            libelle={T.fin}
            type="date"
            valeur={saisie.fin}
            onChange={(fin) => {
              changer({ ...saisie, fin }, false);
            }}
            erreur={erreurs.includes('fin') ? T.erreurFin : undefined}
            aide={T.aideFin}
          />
        </div>
      </div>

      <p className="m-0 text-sm font-semibold text-encre-2">{preavisEnLettres(preavis)}</p>

      {motifUtile && (
        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start font-semibold text-encre">
            <input
              type="checkbox"
              checked={saisie.reduit}
              onChange={(e) => {
                changer({ ...saisie, reduit: e.target.checked }, true);
              }}
              aria-describedby={`${id}-reduit-aide`}
              className="size-5 shrink-0 accent-accent pointer-coarse:size-6"
            />
            {T.reduit}
          </label>
          <p id={`${id}-reduit-aide`} className="m-0 text-sm text-encre-3">
            {T.aideReduit}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Bouton disabled={occupe} onClick={onFermer}>
          {TEXTES_FIN_BAIL.fermer}
        </Bouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrer}
        </Bouton>
      </div>
      {erreur !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}
    </form>
  );
}
