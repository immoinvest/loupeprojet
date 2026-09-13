import * as z from 'zod';

import { PortailSchema } from '../portails';
import { ChampsCaptureSchema } from '../schema';

/** Conversion appliquée à la valeur brute lue sur la page. */
export const TypeValeurSchema = z.enum([
  'texte',
  'montant',
  'nombre',
  'entier',
  'etage',
  'booleen',
  'classe',
  'codePostal',
]);
export type TypeValeur = z.infer<typeof TypeValeurSchema>;

function regexValide(source: string): boolean {
  try {
    new RegExp(source, 'iu');
    return true;
  } catch {
    return false;
  }
}

const OPTIONS_COMMUNES = {
  type: TypeValeurSchema,
  /** Expression régulière (insensible à la casse) appliquée au texte brut ; le groupe 1, ou toute la correspondance, devient la valeur. */
  regex: z.string().min(1).refine(regexValide, 'expression régulière invalide').optional(),
  /** Diviseur appliqué aux nombres : 12 pour ramener des charges annuelles au mois. */
  diviser: z.number().positive().optional(),
  /** Valeur constante rendue dès que la source (et sa regex) trouve quelque chose : « sans ascenseur » → false. */
  valeur: z.union([z.string(), z.number(), z.boolean()]).optional(),
};

/**
 * Chemin dans un objet JSON : `offers.price`, `props.pageProps.ad.attributes[key=square].value`,
 * `additionalProperty[name=Nombre de pièces].value` (la valeur cherchée peut contenir des espaces,
 * pas de point ni de crochet fermant).
 */
const CheminSchema = z.string().min(1);

export const ExtracteurSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('jsonld'),
    chemin: CheminSchema,
    /** Ne considérer que les nœuds de ce `@type` (ex. `Product`, `Offer`, `RealEstateListing`). */
    typeLd: z.string().min(1).optional(),
    ...OPTIONS_COMMUNES,
  }),
  z.object({
    source: z.literal('json'),
    /** Sélecteur du `<script>` qui porte l'état applicatif de la page, ex. `#__NEXT_DATA__`. */
    selecteur: z.string().min(1),
    chemin: CheminSchema,
    ...OPTIONS_COMMUNES,
  }),
  z.object({
    /** Les données de l'annonce chargées par la page elle-même (voir `donnees` des règles). */
    source: z.literal('donnees'),
    chemin: CheminSchema,
    ...OPTIONS_COMMUNES,
  }),
  z.object({
    source: z.literal('meta'),
    /** `property` ou `name` de la balise `<meta>`, ex. `og:description`. */
    nom: z.string().regex(/^[\w:.-]+$/, 'nom de meta'),
    ...OPTIONS_COMMUNES,
  }),
  z.object({
    source: z.literal('css'),
    selecteur: z.string().min(1),
    /** Attribut à lire ; à défaut, le texte visible de l'élément. */
    attribut: z
      .string()
      .regex(/^[\w:-]+$/, "nom d'attribut")
      .optional(),
    ...OPTIONS_COMMUNES,
  }),
]);
export type Extracteur = z.infer<typeof ExtracteurSchema>;

export const NomChampCaptureSchema = ChampsCaptureSchema.keyof();

/**
 * Données qu'une page d'annonce charge elle-même après coup (Bien'ici n'écrit rien dans le HTML) :
 * une adresse **relative** au portail, jamais un autre site, où `{id}` est remplacé par
 * l'identifiant de l'annonce. La lecture reste dans le navigateur de l'utilisateur.
 */
export const DonneesPortailSchema = z.object({
  url: z
    .string()
    .regex(/^\/[^/\\]/, 'adresse relative au portail')
    .refine((u) => u.includes('{id}'), 'doit contenir {id}'),
});
export type DonneesPortail = z.infer<typeof DonneesPortailSchema>;

/**
 * Les règles d'un portail : pour chaque champ, des extracteurs essayés dans l'ordre ; le premier
 * qui donne une valeur valide gagne. Fichier versionné `<portail>-AAAA-MM-JJ`, pensé pour être
 * servi un jour depuis R2 sans republier l'extension.
 */
export const ReglesPortailSchema = z
  .object({
    version: z.string().regex(/^[a-z]+-\d{4}-\d{2}-\d{2}$/, 'version <portail>-AAAA-MM-JJ'),
    portail: PortailSchema,
    donnees: DonneesPortailSchema.optional(),
    champs: z.partialRecord(NomChampCaptureSchema, z.array(ExtracteurSchema).min(1)),
  })
  .refine((r) => r.version.startsWith(`${r.portail}-`), {
    message: 'la version doit commencer par le nom du portail',
    path: ['version'],
  });
export type ReglesPortail = z.infer<typeof ReglesPortailSchema>;
