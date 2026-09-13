import * as z from 'zod';

import { CaptureSchema } from './schema';

/**
 * Protocole entre la page Deklic et l'extension, par `window.postMessage` sur la page Deklic
 * elle-même : le script « pont » de l'extension écoute la page et relaie vers l'extension.
 * Aucun serveur au milieu ; les messages portent une étiquette pour ignorer le reste.
 */
export const SOURCE_WEB = 'deklic-web';
export const SOURCE_EXTENSION = 'deklic-extension';
export const VERSION_PONT = 1;

const IdentifiantSchema = z.string().min(1).max(64);

export const MessageWebSchema = z.discriminatedUnion('type', [
  z.object({ source: z.literal(SOURCE_WEB), type: z.literal('ping'), id: IdentifiantSchema }),
  z.object({
    source: z.literal(SOURCE_WEB),
    type: z.literal('lire'),
    id: IdentifiantSchema,
    url: z.url().max(2_000),
  }),
]);
export type MessageWeb = z.infer<typeof MessageWebSchema>;

/** Pourquoi la lecture automatique n'a rien donné ; le web propose alors le texte collé. */
export const RaisonEchecLectureSchema = z.enum([
  'hors-annonce',
  'portail-sans-regles',
  'permission',
  'chargement',
  'vide',
  'occupe',
]);
export type RaisonEchecLecture = z.infer<typeof RaisonEchecLectureSchema>;

export const ResultatLectureAutoSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), capture: CaptureSchema }),
  z.object({ ok: z.literal(false), raison: RaisonEchecLectureSchema }),
]);
export type ResultatLectureAuto = z.infer<typeof ResultatLectureAutoSchema>;

export const MessageExtensionSchema = z.discriminatedUnion('type', [
  z.object({
    source: z.literal(SOURCE_EXTENSION),
    type: z.literal('pong'),
    id: IdentifiantSchema,
    version: z.number().int().positive(),
  }),
  z.object({
    source: z.literal(SOURCE_EXTENSION),
    type: z.literal('resultat'),
    id: IdentifiantSchema,
    resultat: ResultatLectureAutoSchema,
  }),
]);
export type MessageExtension = z.infer<typeof MessageExtensionSchema>;
