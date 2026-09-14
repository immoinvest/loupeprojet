import { prixRetenu } from '@loupe/moteur';
import { useMemo, useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  INDICATEURS,
  MAX_COMPARES,
  MIN_COMPARES,
  comparerProjets,
  meilleureValeur,
  selectionInitiale,
  triDecroissant,
  trierColonnes,
  type CodeIndicateur,
  type ColonneComparaison,
  type Indicateur,
  type Tri,
} from '@/analyses';
import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Point } from '@/composants/ui';
import { euros } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import { STATUTS, type ProjetEnregistre } from '@/stockage/projets';
import { ETATS } from '@/textes/feux';
import { MODES } from '@/textes/regimes';

function Selection({
  projets,
  choisis,
  onBasculer,
}: {
  projets: readonly ProjetEnregistre[];
  choisis: ReadonlySet<string>;
  onBasculer: (id: string) => void;
}): JSX.Element {
  const complet = choisis.size >= MAX_COMPARES;
  return (
    <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Projets à comparer</legend>
      {projets.map((p) => {
        const coche = choisis.has(p.id);
        return (
          <label
            key={p.id}
            className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-full border px-3.5 text-sm font-semibold ${
              coche ? 'border-accent bg-accent-doux text-encre' : 'border-bordure text-encre-2'
            } ${!coche && complet ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input
              type="checkbox"
              checked={coche}
              disabled={!coche && complet}
              onChange={() => {
                onBasculer(p.id);
              }}
              className="h-4 w-4 accent-accent"
            />
            {p.nom}
            <span className="font-normal text-encre-3">
              {euros(prixRetenu(p.projet.hypotheses.achat))}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function Cellule({
  indicateur,
  colonne,
  meilleure,
}: {
  indicateur: Indicateur;
  colonne: ColonneComparaison;
  meilleure: number | null;
}): JSX.Element {
  const valeur = colonne.valeurs[indicateur.code];
  const feu = indicateur.axe === undefined ? undefined : colonne.feux[indicateur.axe];
  const enAvant = valeur !== null && meilleure !== null && valeur === meilleure;
  return (
    <td className={`px-3 py-2.5 align-top ${enAvant ? 'font-bold text-bon-texte' : ''}`}>
      <span className="inline-flex items-center gap-2">
        {feu !== undefined && (
          <>
            <Point feu={feu} />
            <span className="sr-only">{ETATS[feu]}</span>
          </>
        )}
        {valeur === null ? '—' : indicateur.formater(valeur)}
      </span>
      {indicateur.detail !== undefined && (
        <div className="text-xs font-normal text-encre-3">
          {indicateur.detail(colonne.resultats)}
        </div>
      )}
    </td>
  );
}

function Tableau({
  colonnes,
  tri,
  onTrier,
}: {
  colonnes: readonly ColonneComparaison[];
  tri: Tri | null;
  onTrier: (code: CodeIndicateur) => void;
}): JSX.Element {
  return (
    // `relative` : les libellés des feux réservés aux lecteurs d'écran sont positionnés en absolu ; sans
    // ancêtre positionné, ils échappaient au défilement et élargissaient la page à partir de trois projets.
    <div className="relative overflow-x-auto rounded-carte border border-bordure bg-surface shadow-carte">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr className="border-b border-bordure">
            <th
              scope="col"
              className="sticky left-0 z-[1] min-w-[8rem] bg-surface px-3 py-3 text-left text-xs font-semibold text-encre-3"
            >
              Cliquez une ligne pour trier
            </th>
            {colonnes.map((c) => (
              <th key={c.id} scope="col" className="px-3 py-3 text-left align-top">
                <Link
                  to={`/projets/${c.id}`}
                  className="font-display text-[17px] font-bold text-encre no-underline hover:text-accent pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                >
                  {c.nom}
                </Link>
                <div className="text-xs font-normal text-encre-3">
                  {MODES[c.resultats.projet.hypotheses.location.mode]} · {STATUTS[c.statut]}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {INDICATEURS.map((i) => {
            // Sens de tri de cette ligne : « none » quand elle ne trie pas les colonnes.
            const sens =
              tri !== null && tri.code === i.code
                ? triDecroissant(tri)
                  ? 'descending'
                  : 'ascending'
                : 'none';
            const meilleure = meilleureValeur(colonnes, i);
            return (
              <tr key={i.code} className="border-b border-bordure-douce last:border-b-0">
                <th
                  scope="row"
                  aria-sort={sens}
                  className="sticky left-0 z-[1] min-w-[8rem] bg-surface px-3 py-2.5 text-left align-top font-semibold"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onTrier(i.code);
                    }}
                    className={`text-left hover:text-accent pointer-coarse:min-h-11 pointer-coarse:w-full ${sens === 'none' ? '' : 'text-accent'}`}
                  >
                    {i.libelle}
                    {sens === 'none' ? '' : sens === 'descending' ? ' ↓' : ' ↑'}
                  </button>
                </th>
                {colonnes.map((c) => (
                  <Cellule key={c.id} indicateur={i} colonne={c} meilleure={meilleure} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Comparer(): JSX.Element {
  const { projets } = useProjets();
  const naviguer = useNavigate();
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(
    () => new Set(selectionInitiale(projets)),
  );
  const [tri, setTri] = useState<Tri | null>(null);

  const colonnes = useMemo(
    () => comparerProjets(projets.filter((p) => choisis.has(p.id))),
    [projets, choisis],
  );
  const triees = tri === null ? colonnes : trierColonnes(colonnes, tri);

  const basculer = (id: string): void => {
    setChoisis((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else if (suivant.size < MAX_COMPARES) suivant.add(id);
      return suivant;
    });
  };

  const trierPar = (code: CodeIndicateur): void => {
    setTri((prev) => ({ code, inverse: prev !== null && prev.code === code && !prev.inverse }));
  };

  return (
    <Page>
      <div className="flex flex-col gap-2">
        <TitrePage>Comparer</TitrePage>
        <Chapo>
          Deux à cinq projets côte à côte, avec leurs feux. La meilleure valeur de chaque ligne est
          en vert.
        </Chapo>
      </div>

      {projets.length < MIN_COMPARES ? (
        <Carte className="sm:flex-row sm:items-center sm:gap-5">
          <span className="flex-1 text-[15px] text-encre-2">
            Il vous faut au moins deux projets pour comparer.
          </span>
          <Bouton
            variante="primaire"
            onClick={() => {
              void naviguer('/projets/nouveau');
            }}
          >
            Nouveau projet
          </Bouton>
        </Carte>
      ) : (
        <>
          <Selection projets={projets} choisis={choisis} onBasculer={basculer} />
          {colonnes.length < MIN_COMPARES ? (
            <Carte>
              <p className="m-0 text-[15px] text-encre-2">Choisissez au moins deux projets.</p>
            </Carte>
          ) : (
            <Tableau colonnes={triees} tri={tri} onTrier={trierPar} />
          )}
        </>
      )}
    </Page>
  );
}
