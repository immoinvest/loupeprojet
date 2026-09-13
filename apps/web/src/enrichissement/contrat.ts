import { z } from 'zod';

/**
 * Réponses du Worker (`apps/worker`), revalidées à l'arrivée : le navigateur ne fait confiance à
 * aucune réponse réseau. Les clés inconnues sont ignorées, un champ hors contrat fait échouer la lecture.
 */
const lettre = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

/** POST /extract : les champs lus par le modèle dans le texte de l'annonce, `null` quand absents. */
export const ReponseExtractionSchema = z.object({
  champs: z.object({
    prix: z.number().positive().nullable(),
    surface: z.number().positive().nullable(),
    pieces: z.number().int().positive().nullable(),
    chambres: z.number().int().nonnegative().nullable(),
    etage: z.number().int().nullable(),
    ascenseur: z.boolean().nullable(),
    dpe: lettre.nullable(),
    codePostal: z
      .string()
      .regex(/^\d{5}$/)
      .nullable(),
    ville: z.string().min(1).nullable(),
    annee: z.number().int().nullable(),
    chargesCoproMois: z.number().nonnegative().nullable(),
    taxeFonciere: z.number().nonnegative().nullable(),
    honorairesAgence: z.number().nonnegative().nullable(),
    meuble: z.boolean().nullable(),
  }),
  modele: z.string(),
});
export type ChampsIa = z.infer<typeof ReponseExtractionSchema>['champs'];

/** GET /proxy/geocodage : on n'utilise que le premier résultat. */
export const ResultatGeocodageSchema = z.object({
  libelle: z.string(),
  lat: z.number(),
  lon: z.number(),
  precision: z.string(),
  codeInsee: z.string().nullable(),
  codePostal: z.string().nullable(),
});
export type ResultatGeocodage = z.infer<typeof ResultatGeocodageSchema>;

export const ReponseGeocodageSchema = z.object({
  donnees: z.object({ resultats: z.array(ResultatGeocodageSchema) }),
});

/** GET /marche : ventes réelles (DVF), loyer d'annonce (ANIL, charges comprises), zone ABC. */
export const ReponseMarcheSchema = z.object({
  codeInsee: z.string(),
  commune: z.string().nullable(),
  dvf: z
    .object({
      ventes: z.number().int().positive(),
      medianeM2: z.number().positive(),
      q1M2: z.number().positive(),
      q3M2: z.number().positive(),
    })
    .nullable(),
  loyer: z
    .object({
      loyerM2: z.number().positive(),
      basM2: z.number().positive(),
      hautM2: z.number().positive(),
      observations: z.number().int().nonnegative(),
    })
    .nullable(),
  zone: z.string().nullable(),
  sources: z.array(
    z.object({
      nom: z.string(),
      url: z.string(),
      licence: z.string(),
      mention: z.string().optional(),
    }),
  ),
});
export type ReponseMarche = z.infer<typeof ReponseMarcheSchema>;

/** Corps d'erreur du Worker : un code, jamais un texte. */
export const ErreurWorkerSchema = z.object({ code: z.string() });
