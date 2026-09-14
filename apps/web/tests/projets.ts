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

/**
 * Un projet en courte durée : nuitée 80 €, 60 % d'occupation (18,25 nuits par mois), séjours de
 * 4 nuits, ménage facturé 25 € et payé 40 € par séjour, conciergerie 20 %.
 */
export const courteDuree = (): ProjetEntree =>
  variante({
    location: {
      mode: 'courte_duree',
      nuitee: 80,
      nuiteesParMois: 18.25,
      dureeSejourNuits: 4,
      menageFactureParSejour: 25,
      menageCoutParSejour: 40,
      conciergerieTaux: 0.2,
    },
  });
