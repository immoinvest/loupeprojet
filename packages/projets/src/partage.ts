import { z } from 'zod';

import { migrerEnregistre, ProjetEnregistreSchema, type ProjetEnregistre } from './enregistre';

/**
 * Liens de partage courts (ADR-009) : ce que le web envoie à `POST /api/partage`, ce que l'API
 * rend, et ce qui est partagé. Partagé par l'API des comptes et le web.
 */

/** Un lien court s'éteint 90 jours après sa dernière ouverture. */
export const DUREE_PARTAGE_JOURS = 90;

/** Créations de liens par heure et par adresse IP. */
export const LIMITE_PARTAGES_PAR_HEURE = 10;

/** Taille maximale d'une demande de partage (le projet en JSON), en octets. */
export const TAILLE_MAX_PARTAGE = 64_000;

/** Identifiant d'un lien court : 8 caractères base62 (≈ 2,2 × 10¹⁴ possibilités). */
export const ID_PARTAGE = /^[0-9A-Za-z]{8}$/;

export const LONGUEUR_JETON_MAX = 128;

const JOUR_MS = 86_400_000;

/**
 * Ce qui part dans un lien : le projet sans la visite (réponses et notes, souvent personnelles).
 * L'adresse exacte et l'annonce lue (photos, fiche, jamais de texte) suivent le projet.
 */
export function alleger(enregistre: ProjetEnregistre): ProjetEnregistre {
  const copie = { ...enregistre };
  delete copie.visite;
  return copie;
}

/** Date d'expiration d'un lien ouvert ou créé à `maintenantMs`. */
export function expirationDepuis(maintenantMs: number): string {
  return new Date(maintenantMs + DUREE_PARTAGE_JOURS * JOUR_MS).toISOString();
}

/** Un projet reçu : migré depuis un format antérieur, puis validé. */
const ProjetRecuSchema = z.preprocess(migrerEnregistre, ProjetEnregistreSchema);

export const DemandePartageSchema = z.object({ projet: ProjetRecuSchema });
export type DemandePartage = z.infer<typeof DemandePartageSchema>;

const JetonSchema = z.string().min(1).max(LONGUEUR_JETON_MAX);

/** `201` de `POST /api/partage` : le jeton ne sert qu'à arrêter le partage, gardé par l'appareil. */
export const PartageCreeSchema = z.object({
  id: z.string().regex(ID_PARTAGE),
  jeton: JetonSchema,
  expireLe: z.string(),
});
export type PartageCree = z.infer<typeof PartageCreeSchema>;

/** `200` de `GET /api/partage/:id`. */
export const PartageLuSchema = z.object({ projet: ProjetRecuSchema, expireLe: z.string() });
export type PartageLu = z.infer<typeof PartageLuSchema>;

/** Corps de `DELETE /api/partage/:id`. */
export const DemandeSuppressionPartageSchema = z.object({ jeton: JetonSchema });
