import type { LigneLoyer } from '@loupe/gestion';
import type { JSX } from 'react';
import { Link } from 'react-router';

import { Bouton, Pastille } from '@/composants/ui';
import { leJour, montant } from '@/gestion/format';
import { paiementsAvecRecu, quittancePossible } from '@/gestion/loyers-page';
import { lienFicheBien } from '@/gestion/parcours';
import { marquerRecu, STATUTS_LOYER, TEXTES_GERER, TONS_LOYER } from '@/textes/gerer-ecrans';
import {
  bienEtChambre,
  plusApl,
  recuDe,
  resteAPayer,
  TEXTES_LOYERS as T,
} from '@/textes/gerer-loyers';
import { modifierLaLocation } from '@/textes/gerer-parcours';

import { EnPartie } from './EnPartie';
import { TraceEnvoi } from './envois/TraceEnvoi';
import { NomsDeLocataires } from './NomsDeLocataires';
import type { ActionsLoyer } from './useActionsLoyer';

interface PropsLigne {
  readonly ligne: LigneLoyer;
  readonly aujourdhui: string;
  readonly actions: ActionsLoyer;
  /** La ligne du bien ouvert depuis sa frise : fond accentué et `aria-current`. */
  readonly enEvidence?: boolean;
}

/**
 * Un loyer du mois, sur l'accueil comme sur la page Loyers : le bien (et la chambre), tous les
 * locataires du bail, le dû, le statut en mot, et l'action suivante en un clic.
 */
export function LigneDeLoyer({
  ligne,
  aujourdhui,
  actions,
  enEvidence = false,
}: PropsLigne): JSX.Element {
  const { occupe } = actions;
  const locataires = [ligne.locataire, ...ligne.colocataires].flatMap((l) =>
    l === undefined ? [] : [l],
  );
  const ouvert = actions.enPartie === ligne.location.id;
  const nomDuBien = bienEtChambre(ligne.bien?.nom ?? '', ligne.location.libelle);
  const montantAffiche = montant(ligne.du.apl > 0 ? ligne.du.partLocataire : ligne.du.total);

  return (
    <li
      aria-current={enEvidence ? 'true' : undefined}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-bordure-douce py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_110px_90px_auto] ${
        enEvidence ? 'rounded-encart bg-accent-fond px-2' : ''
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <Link
          to={`/gerer/biens/${ligne.location.bienId}`}
          className="flex min-w-0 items-center text-encre no-underline survol-texte pointer-coarse:min-h-11"
        >
          <span className="block truncate font-bold">{nomDuBien}</span>
        </Link>
        <NomsDeLocataires locataires={locataires} className="truncate text-sm text-encre-3" />
      </span>
      {/* Tiers payant (ADR-G16) : la part du locataire, puis l'aide versée par la CAF. */}
      {/* Le montant mène à la fiche du bien, « Modifier » déjà ouvert : corriger un loyer en deux clics. */}
      <Link
        to={lienFicheBien(ligne.location.bienId, { modifier: ligne.location.id })}
        aria-label={modifierLaLocation(montantAffiche, nomDuBien)}
        className="flex flex-col text-right text-encre tabular-nums no-underline survol-texte pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
      >
        <span className="font-bold underline decoration-bordure decoration-dotted underline-offset-4">
          {montantAffiche}
        </span>
        {ligne.du.apl > 0 && <span className="text-xs text-encre-3">{plusApl(ligne.du.apl)}</span>}
      </Link>
      <span className="hidden text-sm text-encre-3 sm:block">{leJour(ligne.du.echeance)}</span>
      <span className="col-span-2 flex flex-wrap items-center justify-end gap-2 sm:col-span-1">
        <Pastille ton={TONS_LOYER[ligne.statut]} compacte>
          {STATUTS_LOYER[ligne.statut]}
        </Pastille>
        {ligne.statut === 'partiel' && (
          <span className="text-sm text-encre-3 tabular-nums">{resteAPayer(ligne.resteDu)}</span>
        )}
        {paiementsAvecRecu(ligne).map((p) => (
          <Bouton
            key={p.id}
            disabled={occupe}
            onClick={() => void actions.ouvrirDocument({ type: 'recu', paiementId: p.id })}
          >
            {recuDe(p.montant)}
          </Bouton>
        ))}
        {quittancePossible(ligne) && (
          <Bouton
            disabled={occupe}
            onClick={() =>
              void actions.ouvrirDocument({
                type: 'quittance',
                locationId: ligne.location.id,
                periode: ligne.du.periode,
              })
            }
          >
            {T.quittance}
          </Bouton>
        )}
        {ligne.statut !== 'recu' && (
          <>
            <Bouton
              disabled={occupe}
              onClick={() => {
                actions.ouvrirEnPartie(ligne.location.id);
              }}
            >
              {T.enPartie}
            </Bouton>
            <Bouton
              variante="primaire"
              title={marquerRecu(ligne.locataire?.prenom ?? TEXTES_GERER.tonLocataire)}
              disabled={occupe}
              onClick={() => void actions.marquerRecu(ligne)}
            >
              {TEXTES_GERER.recu}
            </Bouton>
          </>
        )}
      </span>
      <TraceEnvoi ligne={ligne} />
      {ouvert && (
        <EnPartie
          ligne={ligne}
          aujourdhui={aujourdhui}
          occupe={occupe}
          onEnregistrer={actions.enregistrerPartiel}
          onFermer={() => {
            actions.ouvrirEnPartie(null);
          }}
        />
      )}
    </li>
  );
}

/** Les lignes d'un mois ou d'un groupe de la page Loyers. */
export function ListeDeLoyers({
  lignes,
  aujourdhui,
  actions,
  enEvidence = null,
}: {
  readonly lignes: readonly LigneLoyer[];
  readonly aujourdhui: string;
  readonly actions: ActionsLoyer;
  /** Le bien dont les lignes sont mises en évidence (`?bien=` de la page Loyers). */
  readonly enEvidence?: string | null;
}): JSX.Element {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {lignes.map((ligne) => (
        <LigneDeLoyer
          key={ligne.location.id}
          ligne={ligne}
          aujourdhui={aujourdhui}
          actions={actions}
          enEvidence={ligne.location.bienId === enEvidence}
        />
      ))}
    </ul>
  );
}
