import {
  argentDesDerniersMois,
  argentDuMois,
  jourLocal,
  periodeDe,
  type BienGere,
  type EtatGestion,
  type Flux,
} from '@loupe/gestion';
import type { JSX } from 'react';
import { Link } from 'react-router';

import { Carte, LienBouton, Ligne, TitreCarte } from '@/composants/ui';
import { useArgent } from '@/gestion/argent/ArgentContext';
import { donneesArgent } from '@/gestion/argent/page';
import { montant } from '@/gestion/format';
import { lienArgent, lienFicheBien, lienNouvelleDepense } from '@/gestion/parcours';
import { montantSigne, TEXTES_ARGENT as T } from '@/textes/gerer-argent';

import { EtatArgentAbsent } from './AttenteArgent';
import { CartePret } from './CartePret';

/** Les quatre lignes d'une période : encaissé, dépenses, mensualités, cash-flow réel. */
export function LignesDeFlux({
  flux,
  cashflow,
}: {
  readonly flux: Flux;
  readonly cashflow: number;
}): JSX.Element {
  return (
    <div>
      <Ligne libelle={T.loyers} valeur={montant(flux.loyers)} />
      <Ligne libelle={T.depenses} valeur={montant(flux.depenses)} />
      <Ligne libelle={T.mensualites} valeur={montant(flux.mensualites)} />
      <Ligne
        fort
        libelle={T.cashflow}
        valeur={montantSigne(cashflow)}
        tonValeur={cashflow < 0 ? 'text-probleme-texte' : 'text-bon-texte'}
      />
    </div>
  );
}

/** « Argent de ce bien », sur sa fiche : ce mois-ci, les 12 derniers mois, ajouter une dépense, le prêt. */
export function CarteArgent({
  bien,
  donnees,
}: {
  readonly bien: BienGere;
  readonly donnees: EtatGestion;
}): JSX.Element {
  const argent = useArgent();
  if (argent.donnees === null) {
    return (
      <Carte>
        <TitreCarte>{T.carteTitre}</TitreCarte>
        <EtatArgentAbsent />
      </Carte>
    );
  }
  const aujourdhui = jourLocal(new Date());
  const periode = periodeDe(aujourdhui);
  const tout = donneesArgent(donnees, argent.donnees);
  const mois = argentDuMois(tout, periode, { bienId: bien.id });
  const douze = argentDesDerniersMois(tout, periode, { bienId: bien.id });

  return (
    <Carte>
      <TitreCarte
        action={
          <Link
            to={lienArgent({ bienId: bien.id })}
            className="inline-flex items-center text-sm font-semibold text-accent survol-texte pointer-coarse:min-h-11"
          >
            {T.voirDetail}
          </Link>
        }
      >
        {T.carteTitre}
      </TitreCarte>
      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-label={T.ceMois} className="flex flex-col gap-1">
          <h3 className="m-0 text-xs font-bold tracking-wider text-encre-3 uppercase">
            {T.ceMois}
          </h3>
          <LignesDeFlux flux={mois} cashflow={mois.cashflow} />
        </section>
        <section aria-label={T.douzeMois} className="flex flex-col gap-1">
          <h3 className="m-0 text-xs font-bold tracking-wider text-encre-3 uppercase">
            {T.douzeMois}
          </h3>
          <LignesDeFlux flux={douze} cashflow={douze.cashflow} />
        </section>
      </div>
      <div>
        <LienBouton to={lienNouvelleDepense({ bienId: bien.id, retour: lienFicheBien(bien.id) })}>
          {T.ajouterDepense}
        </LienBouton>
      </div>
      <CartePret
        bien={bien}
        pret={argent.donnees.prets.find((p) => p.bienId === bien.id)}
        aujourdhui={aujourdhui}
      />
    </Carte>
  );
}
