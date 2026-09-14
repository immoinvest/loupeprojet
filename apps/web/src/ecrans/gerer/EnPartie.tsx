import type { LigneLoyer, NouveauPaiement } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import {
  paiementEnPartie,
  saisieEnPartie,
  type ChampEnPartie,
  type SaisieEnPartie,
} from '@/gestion/loyers-page';
import { ERREURS_EN_PARTIE, resteAPayer, TEXTES_LOYERS as T } from '@/textes/gerer-loyers';

import { ChampGerer } from './ChampGerer';

export interface EnPartieProps {
  readonly ligne: LigneLoyer;
  readonly aujourdhui: string;
  readonly occupe: boolean;
  /** Envoie le paiement ; le formulaire se ferme quand l'écran le décide (réponse de l'API). */
  readonly onEnregistrer: (paiement: NouveauPaiement) => Promise<void>;
  readonly onFermer: () => void;
}

/**
 * « En partie » : le montant reçu et sa date, sous la ligne du loyer. Ouvert par le bouton de la
 * ligne (clic 1), enregistré par « Enregistrer » (clic 2) ; rien n'est envoyé si un champ est faux.
 */
export function EnPartie({
  ligne,
  aujourdhui,
  occupe,
  onEnregistrer,
  onFermer,
}: EnPartieProps): JSX.Element {
  const [saisie, setSaisie] = useState<SaisieEnPartie>(() => saisieEnPartie(aujourdhui));
  const [erreurs, setErreurs] = useState<readonly ChampEnPartie[]>([]);
  const base = `en-partie-${ligne.location.id}`;
  const erreur = (champ: ChampEnPartie): string | undefined =>
    erreurs.includes(champ) ? ERREURS_EN_PARTIE[champ] : undefined;

  const enregistrer = async (): Promise<void> => {
    const lu = paiementEnPartie(ligne, saisie, aujourdhui);
    if (!lu.ok) {
      setErreurs(lu.erreurs);
      document.getElementById(`${base}-${lu.erreurs[0] ?? 'montant'}`)?.focus();
      return;
    }
    setErreurs([]);
    await onEnregistrer(lu.paiement);
  };

  return (
    <form
      aria-label={T.enPartie}
      className="col-span-full flex flex-wrap items-end gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void enregistrer();
      }}
    >
      <div className="min-w-[10rem] flex-1">
        <ChampGerer
          id={`${base}-montant`}
          libelle={T.montantRecu}
          valeur={saisie.montant}
          onChange={(montant) => {
            setSaisie((s) => ({ ...s, montant }));
          }}
          erreur={erreur('montant')}
          aide={resteAPayer(ligne.resteDu)}
          unite="€"
          inputMode="decimal"
          autoComplete="off"
        />
      </div>
      <div className="min-w-[10rem] flex-1">
        <ChampGerer
          id={`${base}-date`}
          libelle={T.dateDuPaiement}
          type="date"
          valeur={saisie.date}
          onChange={(date) => {
            setSaisie((s) => ({ ...s, date }));
          }}
          erreur={erreur('date')}
        />
      </div>
      <div className="flex gap-2">
        <Bouton disabled={occupe} onClick={onFermer}>
          {T.fermer}
        </Bouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrer}
        </Bouton>
      </div>
    </form>
  );
}
