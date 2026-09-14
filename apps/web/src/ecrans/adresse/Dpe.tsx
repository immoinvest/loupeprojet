import type { JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  appliquerDpe,
  classerDpe,
  cleBanAdresse,
  dpeSuggere,
  type DpeAdresse,
  type Resultat,
} from '@/enrichissement';
import { useProjets } from '@/stockage/ProjetsContext';
import type { AdresseBien } from '@/stockage/projets';
import { descriptionDpe, PHRASES_DONNEES_ADRESSE } from '@/textes/donnees-adresse';

const MAX_AFFICHES = 8;

/** Les DPE enregistrés à l'adresse (ADEME), le plus probable en premier ; un clic l'applique au projet. */
export function CarteDpe({
  resultat,
  adresse,
}: {
  resultat: Resultat<readonly DpeAdresse[]>;
  adresse: AdresseBien;
}): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const { projet } = enregistre;

  const corps = (): JSX.Element => {
    if (!resultat.ok) {
      return (
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_DONNEES_ADRESSE.dpeIndisponible}</p>
      );
    }
    if (resultat.valeur.length === 0) {
      return <p className="m-0 text-[15px] text-encre-2">{PHRASES_DONNEES_ADRESSE.dpeAucun}</p>;
    }
    const classes = classerDpe(
      resultat.valeur,
      { surface: projet.bien.surface, etage: projet.bien.etage },
      cleBanAdresse(adresse.codeInsee, adresse.codeVoie, adresse.numero),
      new Date().toISOString().slice(0, 10),
    );
    const suggere = dpeSuggere(classes);
    const applique = (d: DpeAdresse): boolean =>
      projet.provenance['bien.dpe'] === 'ademe' &&
      projet.bien.dpe === d.etiquetteDpe &&
      (d.etiquetteGes === null || projet.bien.ges === d.etiquetteGes);
    return (
      <>
        {suggere === null && (
          <p className="m-0 text-[15px] text-encre-2">{PHRASES_DONNEES_ADRESSE.dpeChoisir}</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {classes.slice(0, MAX_AFFICHES).map((c) => (
            <li
              key={c.dpe.numero}
              className={`flex flex-wrap items-center gap-3 rounded-encart border px-3 py-2 ${
                c === suggere ? 'border-accent bg-accent-fond' : 'border-bordure-douce'
              }`}
            >
              <span className="font-display text-lg font-bold">
                DPE {c.dpe.etiquetteDpe}
                {c.dpe.etiquetteGes === null ? '' : ` · GES ${c.dpe.etiquetteGes}`}
              </span>
              <span className="flex-1 text-[15px] text-encre-2">{descriptionDpe(c.dpe)}</span>
              {c === suggere && (
                <Pastille ton="accent" compacte>
                  le plus proche de votre bien
                </Pastille>
              )}
              {c.expire && (
                <Pastille ton="surveiller" compacte>
                  expiré
                </Pastille>
              )}
              {applique(c.dpe) ? (
                <Pastille ton="bon" compacte>
                  {PHRASES_DONNEES_ADRESSE.dpeApplique}
                </Pastille>
              ) : (
                <Bouton
                  title={`Utiliser le DPE ${c.dpe.numero}`}
                  onClick={() => {
                    mettreAJour(enregistre.id, appliquerDpe(projet, c.dpe));
                  }}
                >
                  Utiliser ce DPE
                </Bouton>
              )}
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-encre-3">
          Source : base des diagnostics de performance énergétique des logements existants (ADEME),
          à moins de 30 m.
        </p>
      </>
    );
  };

  return (
    <Carte>
      <h2 className="m-0 font-display text-[22px] font-semibold">Le DPE du logement</h2>
      {corps()}
    </Carte>
  );
}
