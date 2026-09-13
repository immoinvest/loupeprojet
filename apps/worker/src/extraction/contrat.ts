import { z } from 'zod';

import { ErreurAmontInvalide } from '../erreurs';

export const LONGUEUR_MIN = 40;
export const LONGUEUR_MAX = 8000;

/** POST /extract : le texte de l'annonce, rien d'autre. */
export const RequeteExtractionSchema = z.object({
  texte: z.string().trim().min(LONGUEUR_MIN).max(LONGUEUR_MAX),
});

const lettre = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
const nombre = (min: number, max: number): z.ZodType<number> => z.coerce.number().min(min).max(max);
const entier = (min: number, max: number): z.ZodType<number> =>
  z.coerce.number().int().min(min).max(max);

/** Les champs qu'on demande au modèle, dans l'ordre du prompt. Mêmes noms que la lecture par règles du web. */
export const NOMS_CHAMPS = [
  'prix',
  'surface',
  'pieces',
  'chambres',
  'etage',
  'ascenseur',
  'dpe',
  'ges',
  'codePostal',
  'ville',
  'annee',
  'chargesCoproMois',
  'taxeFonciere',
  'honorairesAgence',
  'meuble',
  'travaux',
  'lotsCopro',
  'coproEnProcedure',
  'loyerActuel',
  'chauffage',
] as const;
export type NomChamp = (typeof NOMS_CHAMPS)[number];

/** Un schéma par champ : une valeur hors contrat est écartée sans rejeter les autres. */
const SCHEMAS: Readonly<Record<NomChamp, z.ZodType>> = {
  prix: nombre(10_000, 10_000_000),
  surface: nombre(5, 2_000),
  pieces: entier(1, 30),
  chambres: entier(0, 20),
  etage: entier(0, 60),
  ascenseur: z.boolean(),
  dpe: lettre,
  ges: lettre,
  codePostal: z.string().regex(/^\d{5}$/),
  ville: z.string().trim().min(1).max(60),
  annee: entier(1500, 2030),
  chargesCoproMois: nombre(0, 5_000),
  taxeFonciere: nombre(0, 50_000),
  honorairesAgence: nombre(0, 200_000),
  meuble: z.boolean(),
  travaux: z.boolean(),
  lotsCopro: entier(1, 5_000),
  coproEnProcedure: z.boolean(),
  loyerActuel: nombre(0, 20_000),
  chauffage: z.enum(['individuel', 'collectif']),
};

export type ChampsAnnonce = Readonly<Record<NomChamp, unknown>>;

export interface Normalisation {
  readonly champs: ChampsAnnonce;
  /** Champs renvoyés par le modèle mais hors contrat (écartés, remplacés par null). */
  readonly rejetes: readonly NomChamp[];
}

/** Ramène la réponse brute du modèle au contrat : clés attendues, null quand absent ou invalide. */
export function normaliserChamps(brut: unknown): Normalisation {
  if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) {
    throw new ErreurAmontInvalide('la réponse du modèle n’est pas un objet');
  }
  const objet = brut as Record<string, unknown>;
  const champs: Record<string, unknown> = {};
  const rejetes: NomChamp[] = [];
  for (const nom of NOMS_CHAMPS) {
    const valeur = objet[nom];
    if (valeur === undefined || valeur === null) {
      champs[nom] = null;
      continue;
    }
    const lecture = SCHEMAS[nom].safeParse(valeur);
    if (lecture.success) {
      champs[nom] = lecture.data;
    } else {
      champs[nom] = null;
      rejetes.push(nom);
    }
  }
  return { champs: champs as ChampsAnnonce, rejetes };
}
