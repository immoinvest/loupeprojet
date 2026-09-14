import { lazy, Suspense, useMemo, type JSX } from 'react';

import { Carte } from '@/composants/ui';
import { donneesCarte, type ClassePrix, type ReponseAdresse } from '@/enrichissement';
import type { AdresseBien } from '@/stockage/projets';
import { legendeCarte, libelleAccessibleCarte, PHRASES_CARTE, phraseCarte } from '@/textes/carte';

/** Leaflet et son CSS ne sont chargés qu'à l'ouverture d'une carte. */
const CarteVentes = lazy(() => import('./CarteVentes'));

const PASTILLE: Readonly<Record<ClassePrix, string>> = {
  bas: 'bg-bon',
  milieu: 'bg-encre-4',
  haut: 'bg-surveiller',
};

const HAUTEUR = 'h-[280px] sm:h-[380px]';

/**
 * Les ventes comparables du quartier sur une carte, avec leur légende (l'attribution IGN est sur la carte).
 * Absente sans vente géolocalisée ; jamais imprimée, les tableaux la remplacent sur papier.
 */
export function CarteQuartier({
  analyse,
  adresse,
}: {
  analyse: ReponseAdresse;
  adresse: AdresseBien;
}): JSX.Element | null {
  const donnees = useMemo(() => donneesCarte(analyse), [analyse]);
  if (donnees === null) return null;
  return (
    <Carte className="print:hidden">
      <h2 className="m-0 font-display text-[22px] font-semibold">{PHRASES_CARTE.titre}</h2>
      <p className="m-0 text-[15px] text-encre-2">{phraseCarte(donnees.points.length)}</p>
      <ul
        aria-label="Légende de la carte"
        className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-encre-2"
      >
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-accent" />
          {PHRASES_CARTE.bien}
        </li>
        {legendeCarte(donnees.repere).map((entree) => (
          <li key={entree.classe} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-block h-3 w-3 rounded-full ${PASTILLE[entree.classe]}`}
            />
            {entree.libelle}
          </li>
        ))}
      </ul>
      <Suspense
        fallback={
          <p className={`m-0 text-sm text-encre-3 ${HAUTEUR}`}>{PHRASES_CARTE.chargement}</p>
        }
      >
        <CarteVentes
          lat={adresse.lat}
          lon={adresse.lon}
          points={donnees.points}
          libelle={libelleAccessibleCarte(donnees.points.length)}
        />
      </Suspense>
    </Carte>
  );
}
