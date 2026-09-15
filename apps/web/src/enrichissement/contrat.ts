import { PortailSchema } from '@loupe/capture';
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
    /** Loyer mensuel du locataire en place ; absent des tests et des réponses d'un Worker qui l'ignorerait. */
    loyerActuel: z.number().nonnegative().nullable().optional(),
    /** Absents des réponses mises en cache avant la version 2 du prompt. */
    etat: z.enum(['a_renover', 'a_rafraichir', 'bon_etat', 'renove']).nullable().optional(),
    exterieur: z.boolean().nullable().optional(),
    /** Absent des réponses mises en cache avant la version 3 du prompt. */
    typeLocation: z
      .enum(['nu', 'meuble', 'colocation', 'courte_duree', 'moyenne_duree'])
      .nullable()
      .optional(),
  }),
  modele: z.string(),
});
export type ChampsIa = z.infer<typeof ReponseExtractionSchema>['champs'];

/**
 * POST /lecture : la page d'une annonce, récupérée par le Worker quand l'extension ne le peut pas
 * (ADR-008). Le HTML ne vit qu'en mémoire, le temps d'y appliquer les règles.
 */
export const ReponseLectureSchema = z.object({
  portail: PortailSchema,
  url: z.url(),
  page: z.discriminatedUnion('type', [
    z.object({ type: z.literal('html'), html: z.string().min(1).max(3_000_000) }),
    z.object({ type: z.literal('donnees'), donnees: z.record(z.string(), z.unknown()) }),
  ]),
  tentatives: z.number().int().min(1).max(2),
  obtenuLe: z.iso.datetime(),
});
export type PageLue = z.infer<typeof ReponseLectureSchema>;

/** GET /proxy/geocodage : on n'utilise que le premier résultat. */
export const ResultatGeocodageSchema = z.object({
  libelle: z.string(),
  lat: z.number(),
  lon: z.number(),
  precision: z.string(),
  /** Clé BAN : `13205_6659_00144` = commune, code de la voie, numéro. */
  cleBan: z.string().nullable().optional(),
  codeInsee: z.string().nullable(),
  codePostal: z.string().nullable(),
});
export type ResultatGeocodage = z.infer<typeof ResultatGeocodageSchema>;

export const ReponseGeocodageSchema = z.object({
  donnees: z.object({ resultats: z.array(ResultatGeocodageSchema) }),
});

/** Une commune de l'API Géo : Paris, Lyon et Marseille entières (l'arrondissement suit le code postal). */
export const CommuneSchema = z.object({
  nom: z.string(),
  codeInsee: z.string(),
  codesPostaux: z.array(z.string()),
});
export type Commune = z.infer<typeof CommuneSchema>;

/** GET /proxy/communes : communes d'un code postal, ou dont le nom commence par la recherche. */
export const ReponseCommunesSchema = z.object({
  donnees: z.object({ communes: z.array(CommuneSchema) }),
});

const SourceSchema = z.object({
  nom: z.string(),
  url: z.string(),
  licence: z.string(),
  mention: z.string().optional(),
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
      /** Fenêtre des ventes publiées, date médiane et ancienneté : absentes d'un Worker d'avant la version 0.7. */
      fenetre: z.object({ debut: z.string(), fin: z.string() }).optional(),
      dateMediane: z.string().nullable().optional(),
      ancienneteMedianeMois: z.number().int().nonnegative().nullable().optional(),
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
  sources: z.array(SourceSchema),
});
export type ReponseMarche = z.infer<typeof ReponseMarcheSchema>;

export const CodeGroupeSchema = z.enum([
  'meme_parcelle',
  'parcelles_voisines',
  'meme_cote',
  'en_face',
  'rayon_100',
  'rayon_200',
  'rayon_300',
]);
export type CodeGroupe = z.infer<typeof CodeGroupeSchema>;

const StatistiquesPrixSchema = z.object({
  ventes: z.number().int().positive(),
  medianeM2: z.number().positive(),
  q1M2: z.number().positive(),
  q3M2: z.number().positive(),
  minM2: z.number().positive(),
  maxM2: z.number().positive(),
});
export type StatistiquesPrix = z.infer<typeof StatistiquesPrixSchema>;

/** GET /marche/adresse : ventes autour d'une adresse précise, par groupe, et repère de prix. */
export const ReponseAdresseSchema = z.object({
  codeInsee: z.string(),
  millesime: z.string().nullable(),
  parcelle: z.string().nullable(),
  parcellesVoisines: z.array(z.string()),
  cadastre: z.enum(['ok', 'indisponible']),
  ventesCommune: z.number().int().nonnegative(),
  groupes: z.array(
    z.object({
      code: CodeGroupeSchema,
      ventes: z.number().int().nonnegative(),
      comparables: z.number().int().nonnegative(),
      statistiques: StatistiquesPrixSchema.nullable(),
      distanceMaxMetres: z.number().nonnegative().nullable(),
    }),
  ),
  reference: z
    .object({
      code: CodeGroupeSchema,
      rayonMetres: z.number().positive(),
      statistiques: StatistiquesPrixSchema,
      /** Dates des ventes comparables du repère : absentes d'un Worker d'avant la version 0.7. */
      dateMediane: z.string().nullable().optional(),
      periode: z.object({ debut: z.string(), fin: z.string() }).nullable().optional(),
      ancienneteMedianeMois: z.number().int().nonnegative().nullable().optional(),
    })
    .nullable(),
  ventesProches: z.array(
    z.object({
      date: z.string(),
      prix: z.number().positive(),
      surface: z.number().positive(),
      prixM2: z.number().positive(),
      /** Prix au m² ramené au dernier semestre connu ; absent dans les réponses d'avant la tendance. */
      prixM2Actualise: z.number().positive().optional(),
      coefficient: z.number().positive().optional(),
      /** Prix au m² actualisé et ramené à la surface du bien ; absent dans les réponses plus anciennes. */
      prixM2Corrige: z.number().positive().optional(),
      correctionSurface: z.number().positive().optional(),
      pieces: z.number().int().nonnegative(),
      type: z.enum(['appartement', 'maison']),
      adresse: z.string().nullable(),
      distanceMetres: z.number().nonnegative().nullable(),
      groupes: z.array(CodeGroupeSchema),
    }),
  ),
  /** Évolution locale des prix qui a servi à actualiser les ventes ; `null` quand elle est inconnue. */
  tendance: z
    .object({
      zone: z.enum(['commune', 'departement']),
      periodeReference: z.string().regex(/^\d{4}-S[12]$/),
      evolution1an: z.number().nullable(),
      evolution2ans: z.number().nullable(),
      points: z.array(
        z.object({
          periode: z.string().regex(/^\d{4}-S[12]$/),
          ventes: z.number().int().positive(),
          medianeM2: z.number().positive(),
          indice: z.number().positive(),
        }),
      ),
    })
    .nullable()
    .optional(),
  /** Ventes comparables géolocalisées à 300 m au plus, pour la carte ; absentes avant la version 0.8 du Worker. */
  ventesCarte: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        date: z.string(),
        prix: z.number().positive(),
        surface: z.number().positive(),
        prixM2Corrige: z.number().positive(),
        distanceMetres: z.number().nonnegative(),
        groupes: z.array(CodeGroupeSchema),
      }),
    )
    .optional(),
  /** Communes voisines dont les ventes comptent dans les cercles ; absent avant la version 0.6 du Worker. */
  communesVoisines: z
    .array(z.object({ codeInsee: z.string(), ventes: z.number().int().nonnegative() }))
    .optional(),
  sources: z.array(SourceSchema),
});
export type ReponseAdresse = z.infer<typeof ReponseAdresseSchema>;
export type TendanceAdresse = NonNullable<ReponseAdresse['tendance']>;
export type ReferenceAdresse = NonNullable<ReponseAdresse['reference']>;
export type VenteCarte = NonNullable<ReponseAdresse['ventesCarte']>[number];

/** GET /proxy/dpe : DPE de la base ADEME enregistrés autour de l'adresse, du plus proche au plus récent. */
export const DpeAdresseSchema = z.object({
  numero: z.string(),
  date: z.string().nullable(),
  finValidite: z.string().nullable(),
  etiquetteDpe: lettre,
  etiquetteGes: lettre.nullable(),
  typeBatiment: z.string().nullable(),
  surface: z.number().positive().nullable(),
  etage: z.number().nullable(),
  complement: z.string().nullable(),
  cleBan: z.string().nullable(),
  anneeConstruction: z.number().nullable(),
  distanceMetres: z.number().nonnegative(),
});
export type DpeAdresse = z.infer<typeof DpeAdresseSchema>;

export const ReponseDpeSchema = z.object({
  donnees: z.object({ dpe: z.array(DpeAdresseSchema) }),
});

export const NiveauRisqueAdresseSchema = z.enum(['fort', 'moyen', 'faible', 'inconnu', 'absent']);
export type NiveauRisqueAdresse = z.infer<typeof NiveauRisqueAdresseSchema>;

/** GET /proxy/risques : rapport Géorisques, niveau à l'adresse et dans la commune. */
export const ReponseRisquesSchema = z.object({
  donnees: z.object({
    url: z.string().nullable(),
    risques: z.array(
      z.object({
        code: z.string(),
        famille: z.enum(['naturel', 'technologique']),
        libelle: z.string(),
        adresse: NiveauRisqueAdresseSchema,
        commune: NiveauRisqueAdresseSchema,
      }),
    ),
  }),
});
export type ReponseRisques = z.infer<typeof ReponseRisquesSchema>['donnees'];
export type RisqueAdresse = ReponseRisques['risques'][number];

/** Corps d'erreur du Worker : un code, jamais un texte. */
export const ErreurWorkerSchema = z.object({ code: z.string() });
