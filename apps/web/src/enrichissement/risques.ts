import type { Projet, Risque } from '@loupe/moteur';

import type { ReponseRisques } from './contrat';

/** Les risques présents à l'adresse (fort, moyen ou faible), au format du moteur. Ceux de la commune seule restent affichés. */
export function risquesDuProjet(reponse: ReponseRisques): Risque[] {
  return reponse.risques.flatMap((r) =>
    r.adresse === 'fort' || r.adresse === 'moyen' || r.adresse === 'faible'
      ? [{ type: r.code, niveau: r.adresse }]
      : [],
  );
}

const signature = (risques: readonly Risque[]): string =>
  risques
    .map((r) => `${r.type}:${r.niveau}`)
    .sort()
    .join('|');

export function memesRisques(a: readonly Risque[], b: readonly Risque[]): boolean {
  return signature(a) === signature(b);
}

/** Écrit les risques de l'adresse dans le projet, provenance « georisques ». */
export function appliquerRisques(projet: Projet, risques: readonly Risque[]): Projet {
  return {
    ...projet,
    marche: { ...projet.marche, risques: [...risques] },
    provenance: { ...projet.provenance, 'marche.risques': 'georisques' },
  };
}
