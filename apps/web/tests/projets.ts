import { projetExemple, type ProjetEntree } from '@loupe/moteur';

/** Le projet d'exemple avec d'autres hypothèses (et, au besoin, un autre marché). */
export const variante = (
  h: Partial<ProjetEntree['hypotheses']>,
  marche?: ProjetEntree['marche'],
): ProjetEntree => ({
  ...projetExemple,
  ...(marche === undefined ? {} : { marche }),
  hypotheses: { ...projetExemple.hypotheses, ...h },
});

/** Un projet en courte durée : nuitée 80 €, 60 % d'occupation, ménage 10 € par nuit, conciergerie 20 %. */
export const courteDuree = (): ProjetEntree =>
  variante({
    location: {
      mode: 'courte_duree',
      loyerHc: 0,
      courteDuree: {
        nuitee: 80,
        tauxOccupation: 0.6,
        fraisMenageParNuit: 10,
        conciergerieTaux: 0.2,
      },
    },
  });
