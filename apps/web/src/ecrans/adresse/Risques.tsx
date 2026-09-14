import type { JSX } from 'react';

import { Carte, Pastille } from '@/composants/ui';
import type {
  NiveauRisqueAdresse,
  ReponseRisques,
  Resultat,
  RisqueAdresse,
} from '@/enrichissement';
import { LIBELLES_NIVEAUX, PHRASES_DONNEES_ADRESSE } from '@/textes/donnees-adresse';

const TONS = {
  fort: 'probleme',
  moyen: 'surveiller',
  faible: 'neutre',
  inconnu: 'neutre',
  absent: 'neutre',
} as const satisfies Record<NiveauRisqueAdresse, string>;

const A_L_ADRESSE: readonly NiveauRisqueAdresse[] = ['fort', 'moyen', 'faible'];

function Liste({
  titre,
  risques,
  niveau,
}: {
  titre: string;
  risques: readonly RisqueAdresse[];
  niveau: (r: RisqueAdresse) => NiveauRisqueAdresse;
}): JSX.Element | null {
  if (risques.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-bold text-encre-2">{titre}</h3>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {risques.map((r) => (
          <li key={r.code}>
            <Pastille ton={TONS[niveau(r)]} compacte>
              {r.libelle} · {LIBELLES_NIVEAUX[niveau(r)]}
            </Pastille>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rapport Géorisques : risques à l'adresse (comptés dans le verdict), puis ceux de la commune seulement. */
export function CarteRisques({ resultat }: { resultat: Resultat<ReponseRisques> }): JSX.Element {
  const titre = <h2 className="m-0 font-display text-[22px] font-semibold">Les risques</h2>;
  if (!resultat.ok) {
    return (
      <Carte>
        {titre}
        <p className="m-0 text-[15px] text-encre-2">
          {PHRASES_DONNEES_ADRESSE.risquesIndisponibles}
        </p>
      </Carte>
    );
  }
  const { risques, url } = resultat.valeur;
  const adresse = risques.filter((r) => A_L_ADRESSE.includes(r.adresse));
  const commune = risques.filter(
    (r) => !A_L_ADRESSE.includes(r.adresse) && A_L_ADRESSE.includes(r.commune),
  );
  return (
    <Carte>
      {titre}
      {adresse.length === 0 && commune.length === 0 ? (
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_DONNEES_ADRESSE.risquesAucun}</p>
      ) : (
        <>
          <Liste titre="À l'adresse" risques={adresse} niveau={(r) => r.adresse} />
          <Liste
            titre="Dans la commune, pas à l'adresse connue"
            risques={commune}
            niveau={(r) => r.commune}
          />
        </>
      )}
      <p className="m-0 text-xs text-encre-3">
        {PHRASES_DONNEES_ADRESSE.risquesAppliques} Source : Géorisques.{' '}
        {url !== null && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            Voir le rapport officiel
          </a>
        )}
      </p>
    </Carte>
  );
}
