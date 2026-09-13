import { CaptureSchema, capturer, resoudreAnnonce, type Registre } from '@loupe/capture';
import * as z from 'zod';

export const RaisonLectureSchema = z.enum(['hors-annonce', 'portail-sans-regles']);
export type RaisonLecture = z.infer<typeof RaisonLectureSchema>;

/** Ce que le script de contenu laisse au popup : une capture, ou la raison de son absence. */
export const ResultatLectureSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), capture: CaptureSchema }),
  z.object({ ok: z.literal(false), raison: RaisonLectureSchema }),
]);
export type ResultatLecture = z.infer<typeof ResultatLectureSchema>;

/** Lit la page ouverte avec les règles de son portail. Pur : reçoit le document et l'URL. */
export function lirePage(document: Document, url: string, registre: Registre): ResultatLecture {
  const annonce = resoudreAnnonce(url);
  if (annonce === null) return { ok: false, raison: 'hors-annonce' };
  const regles = registre.reglesDuPortail(annonce.portail);
  if (regles === undefined) return { ok: false, raison: 'portail-sans-regles' };
  const capture = capturer(document, url, regles, { mode: 'extension' });
  return capture === null ? { ok: false, raison: 'hors-annonce' } : { ok: true, capture };
}
