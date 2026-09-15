import { JourSchema } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import { TEXTES_FICHE as F } from '@/textes/gerer-fiche';

import { ChampGerer } from '../ChampGerer';

export interface TerminerLocationProps {
  /** Identifiant du champ date, unique dans la page (une fiche peut montrer plusieurs chambres). */
  readonly id: string;
  readonly aujourdhui: string;
  readonly occupe: boolean;
  /** Une erreur de l'API (loyers déjà reçus après la sortie, sortie avant l'entrée). */
  readonly erreur: string | null;
  /** La location reçoit l'APL : le bailleur doit signaler le départ à la CAF (CCH, art. L823-6). */
  readonly rappelCaf: boolean;
  readonly onEnregistrer: (fin: string) => Promise<void>;
  readonly onFermer: () => void;
}

/** « Terminer la location » (clic 1) ouvre ce formulaire ; « Enregistrer la sortie » (clic 2), date du jour par défaut. */
export function TerminerLocation({
  id,
  aujourdhui,
  occupe,
  erreur,
  rappelCaf,
  onEnregistrer,
  onFermer,
}: TerminerLocationProps): JSX.Element {
  const [fin, setFin] = useState(aujourdhui);
  const [invalide, setInvalide] = useState(false);

  return (
    <form
      aria-label={F.terminer}
      className="flex flex-wrap items-end gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!JourSchema.safeParse(fin).success) {
          setInvalide(true);
          document.getElementById(id)?.focus();
          return;
        }
        setInvalide(false);
        void onEnregistrer(fin);
      }}
    >
      <div className="min-w-[10rem] flex-1">
        <ChampGerer
          id={id}
          libelle={F.dateSortie}
          type="date"
          valeur={fin}
          onChange={setFin}
          erreur={invalide ? F.erreurDateSortie : undefined}
        />
      </div>
      <div className="flex gap-2">
        <Bouton disabled={occupe} onClick={onFermer}>
          {F.fermer}
        </Bouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {F.enregistrerSortie}
        </Bouton>
      </div>
      {rappelCaf && <p className="m-0 basis-full text-sm text-encre-2">{F.rappelCaf}</p>}
      {erreur !== null && (
        <p
          role="alert"
          className="m-0 basis-full rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}
    </form>
  );
}
