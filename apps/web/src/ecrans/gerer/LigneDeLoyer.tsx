import type { LigneLoyer } from '@loupe/gestion';
import type { JSX } from 'react';
import { Link } from 'react-router';

import { Bouton, Pastille } from '@/composants/ui';
import { leJour, montant } from '@/gestion/format';
import { paiementsAvecRecu, quittancePossible } from '@/gestion/loyers-page';
import { marquerRecu, STATUTS_LOYER, TEXTES_GERER, TONS_LOYER } from '@/textes/gerer-ecrans';
import {
  bienEtChambre,
  nomsDesLocataires,
  recuDe,
  resteAPayer,
  TEXTES_LOYERS as T,
} from '@/textes/gerer-loyers';

import { EnPartie } from './EnPartie';
import type { ActionsLoyer } from './useActionsLoyer';

interface PropsLigne {
  readonly ligne: LigneLoyer;
  readonly aujourdhui: string;
  readonly actions: ActionsLoyer;
}

/**
 * Un loyer du mois, sur l'accueil comme sur la page Loyers : le bien (et la chambre), tous les
 * locataires du bail, le dû, le statut en mot, et l'action suivante en un clic.
 */
export function LigneDeLoyer({ ligne, aujourdhui, actions }: PropsLigne): JSX.Element {
  const { occupe } = actions;
  const noms = [ligne.locataire, ...ligne.colocataires].flatMap((l) =>
    l === undefined ? [] : [`${l.prenom} ${l.nom}`],
  );
  const ouvert = actions.enPartie === ligne.location.id;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-bordure-douce py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_110px_90px_auto]">
      <span className="flex min-w-0 flex-col">
        <Link
          to={`/gerer/biens/${ligne.location.bienId}`}
          className="flex min-w-0 items-center text-encre no-underline hover:underline pointer-coarse:min-h-11"
        >
          <span className="block truncate font-bold">
            {bienEtChambre(ligne.bien?.nom ?? '', ligne.location.libelle)}
          </span>
        </Link>
        <span className="truncate text-sm text-encre-3">{nomsDesLocataires(noms)}</span>
      </span>
      <span className="text-right font-bold tabular-nums">{montant(ligne.du.total)}</span>
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
}: {
  readonly lignes: readonly LigneLoyer[];
  readonly aujourdhui: string;
  readonly actions: ActionsLoyer;
}): JSX.Element {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {lignes.map((ligne) => (
        <LigneDeLoyer
          key={ligne.location.id}
          ligne={ligne}
          aujourdhui={aujourdhui}
          actions={actions}
        />
      ))}
    </ul>
  );
}
