import { z } from 'zod';

import { definirService } from './types';

/**
 * Diagnostics de performance énergétique des logements existants (base ADEME, DPE depuis juillet 2021) :
 * https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines?geo_distance=lon,lat,rayon
 */
export const URL_ADEME = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines';

const CHAMPS = [
  'numero_dpe',
  'date_etablissement_dpe',
  'date_fin_validite_dpe',
  'etiquette_dpe',
  'etiquette_ges',
  'type_batiment',
  'surface_habitable_logement',
  'numero_etage_appartement',
  'complement_adresse_logement',
  'identifiant_ban',
  'annee_construction',
] as const;

const ParametresSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  rayon: z.coerce.number().int().min(10).max(100).default(30),
});

const texte = z.string().nullish();
const nombre = z.number().nullish();

const ReponseAdemeSchema = z.object({
  results: z.array(
    z.object({
      numero_dpe: z.string(),
      date_etablissement_dpe: texte,
      date_fin_validite_dpe: texte,
      etiquette_dpe: texte,
      etiquette_ges: texte,
      type_batiment: texte,
      surface_habitable_logement: nombre,
      numero_etage_appartement: nombre,
      complement_adresse_logement: texte,
      identifiant_ban: texte,
      annee_construction: nombre,
      _geo_distance: nombre,
    }),
  ),
});

const LETTRES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type Lettre = (typeof LETTRES)[number];

export interface DpeAdresse {
  readonly numero: string;
  readonly date: string | null;
  readonly finValidite: string | null;
  readonly etiquetteDpe: Lettre;
  readonly etiquetteGes: Lettre | null;
  /** `appartement`, `maison` ou `immeuble` (DPE collectif). */
  readonly typeBatiment: string | null;
  readonly surface: number | null;
  readonly etage: number | null;
  /** « 1er étage », « Rdc », « Lot 12 »… tel que saisi par le diagnostiqueur. */
  readonly complement: string | null;
  readonly cleBan: string | null;
  readonly anneeConstruction: number | null;
  readonly distanceMetres: number;
}

export interface ReponseDpe {
  readonly dpe: readonly DpeAdresse[];
}

function lettre(valeur: string | null | undefined): Lettre | null {
  return LETTRES.find((l) => l === valeur) ?? null;
}

function libre(valeur: string | null | undefined): string | null {
  const nettoye = valeur?.trim();
  return nettoye === undefined || nettoye === '' ? null : nettoye;
}

const dateTri = (date: string | null): string => date ?? '';

/**
 * Étage lu dans le complément d'adresse saisi par le diagnostiqueur : « Rdc », « Rez de Chaussée », « Etage 4 »,
 * « Etage : 3ème », « ETG 1 », « 2ème étage », « 1er Etage », « 5eme ». `null` quand il n'en dit rien.
 */
export function etageDepuisComplement(complement: string | null): number | null {
  if (complement === null) return null;
  if (/\brdc\b|rez[\s-]+de[\s-]+chauss/i.test(complement)) return 0;
  const apresMot = /(?:[eéÉ]tage|\betg)\s*:?\s*(\d{1,2})/i.exec(complement)?.[1];
  const avantMot = /(\d{1,2})\s*(?:er|ère|e|ème|eme)?\s*[eéÉ]tage/i.exec(complement)?.[1];
  const enTete = /^\s*(\d{1,2})\s*(?:er|ère|ème|eme|e)(?![\p{L}])/iu.exec(complement)?.[1];
  const etage = apresMot ?? avantMot ?? enTete;
  return etage === undefined ? null : Number(etage);
}

/**
 * La base ADEME met 0 par défaut dans `numero_etage_appartement` : le complément d'adresse fait foi ;
 * à défaut, un numéro d'étage non nul ; sinon l'étage reste inconnu.
 */
function etageDuDpe(complement: string | null, numero: number | null | undefined): number | null {
  return (
    etageDepuisComplement(complement) ??
    (numero !== null && numero !== undefined && numero > 0 ? numero : null)
  );
}

export const dpe = definirService({
  nom: 'dpe',
  ttlSecondes: 7 * 24 * 3600,
  delaiMs: 8000,
  parametres: ParametresSchema,
  urlAmont: (p) => {
    const url = new URL(URL_ADEME);
    url.searchParams.set('geo_distance', `${String(p.lon)},${String(p.lat)},${String(p.rayon)}`);
    url.searchParams.set('size', '50');
    url.searchParams.set('select', CHAMPS.join(','));
    return url;
  },
  reponseAmont: ReponseAdemeSchema,
  normaliser: (amont): ReponseDpe => ({
    dpe: amont.results
      .flatMap((l): DpeAdresse[] => {
        const etiquette = lettre(l.etiquette_dpe);
        if (etiquette === null) return [];
        const complement = libre(l.complement_adresse_logement);
        return [
          {
            numero: l.numero_dpe,
            date: l.date_etablissement_dpe ?? null,
            finValidite: l.date_fin_validite_dpe ?? null,
            etiquetteDpe: etiquette,
            etiquetteGes: lettre(l.etiquette_ges),
            typeBatiment: l.type_batiment ?? null,
            surface: l.surface_habitable_logement ?? null,
            etage: etageDuDpe(complement, l.numero_etage_appartement),
            complement,
            cleBan: l.identifiant_ban ?? null,
            anneeConstruction: l.annee_construction ?? null,
            distanceMetres: Math.round(l._geo_distance ?? 0),
          },
        ];
      })
      .sort(
        (a, b) =>
          a.distanceMetres - b.distanceMetres || dateTri(b.date).localeCompare(dateTri(a.date)),
      ),
  }),
});
