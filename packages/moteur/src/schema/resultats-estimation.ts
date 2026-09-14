import { z } from 'zod';

const n = z.number();
const nOuNull = z.number().nullable();

/** Le résultat de l'estimation du prix, validé à la sortie du moteur (`ResultatsSchema`). */
const EtatSchema = z.enum(['a_renover', 'a_rafraichir', 'bon_etat', 'renove']);

export const EstimationResultatSchema = z.strictObject({
  etat: EtatSchema,
  etatSuppose: z.boolean(),
  prixM2Marche: n,
  corrections: z.array(
    z.strictObject({
      code: z.enum(['dpe', 'etage', 'exterieur', 'occupation', 'charges']),
      taux: n,
      montant: n,
      ignoree: z.boolean(),
    }),
  ),
  prixM2Estime: n,
  centre: n,
  bas: n,
  haut: n,
  selonEtat: z.strictObject({ a_renover: n, a_rafraichir: n, bon_etat: n, renove: n }),
  confiance: z.strictObject({
    note: n,
    niveau: z.enum(['tres_faible', 'faible', 'moyenne', 'bonne', 'elevee']),
    precision: z.enum(['immeuble', 'rue', 'quartier', 'commune']),
    composantes: z.array(
      z.strictObject({
        code: z.enum(['localisation', 'comparables', 'dispersion', 'anciennete']),
        valeur: nOuNull,
        points: n,
        maximum: n,
        supposee: z.boolean(),
      }),
    ),
  }),
  marge: n,
  charges: z
    .strictObject({
      repereAnnuel: n,
      excedentAnnuel: n,
      rendementLocal: n,
      borneAtteinte: z.boolean(),
    })
    .nullable(),
  actualiseAu: z.string().nullable(),
  ecartPrix: n,
});
