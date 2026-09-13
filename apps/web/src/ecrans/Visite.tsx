import { useState, type JSX } from 'react';
import { Link } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { libelleFeu } from '@/textes/feux';
import {
  CATEGORIES,
  ORDRE_CATEGORIES,
  categorieVigilance,
  phraseVigilance,
} from '@/textes/vigilance';

export function Visite(): JSX.Element {
  const { enregistre, resultats: r } = useProjetCourant();
  const [coches, setCoches] = useState<ReadonlySet<string>>(new Set());
  const points = r.verdict.vigilance.map((p, i) => ({
    cle: `${p.code}-${String(i)}`,
    categorie: categorieVigilance(p.code),
    phrase: phraseVigilance(p),
  }));

  const basculer = (cle: string): void => {
    setCoches((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  };

  return (
    <Page>
      <div className="flex flex-col gap-2">
        <TitrePage taille="volet">Préparer la visite</TitrePage>
        <Chapo>
          {points.length} {points.length > 1 ? 'points déduits' : 'point déduit'} de ce projet.{' '}
          <span className="font-semibold">
            {coches.size} sur {points.length} vérifiés
          </span>{' '}
          (sur cet écran seulement).
        </Chapo>
        <div className="flex flex-wrap gap-2.5 pt-1" aria-label="Cinq feux">
          {r.verdict.feux.map((f) => (
            <Pastille key={f.axe} ton={f.feu} feu={f.feu} compacte>
              {libelleFeu(f)}
            </Pastille>
          ))}
        </div>
      </div>

      {ORDRE_CATEGORIES.map((categorie) => {
        const liste = points.filter((p) => p.categorie === categorie);
        if (liste.length === 0) return null;
        return (
          <Carte key={categorie}>
            <h2 className="m-0 font-display text-[22px] font-semibold">{CATEGORIES[categorie]}</h2>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {liste.map((p) => (
                <li key={p.cle}>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-encart px-2 hover:bg-accent-fond">
                    <input
                      type="checkbox"
                      checked={coches.has(p.cle)}
                      onChange={() => {
                        basculer(p.cle);
                      }}
                      className="h-5 w-5 accent-accent"
                    />
                    <span
                      className={`text-[15px] ${coches.has(p.cle) ? 'text-encre-3 line-through' : ''}`}
                    >
                      {p.phrase}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Carte>
        );
      })}

      <Carte className="border-accent-bordure bg-accent-fond">
        <p className="m-0 text-[15px] text-encre-2">
          Après la visite, reportez ce que vous avez appris dans{' '}
          <Link to={`/projets/${enregistre.id}/hypotheses`} className="font-bold">
            vos hypothèses
          </Link>{' '}
          : le rapport se recalcule.
        </p>
      </Carte>
    </Page>
  );
}
