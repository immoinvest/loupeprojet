import {
  ResultatLectureAutoSchema,
  capturerAvecDonnees,
  resoudreAnnonce,
  type ChargeurDonnees,
  type Registre,
  type ResultatLectureAuto,
} from '@loupe/capture';

/** Ce que le script de contenu rend : une capture, ou la raison de son absence. */
export const ResultatLectureSchema = ResultatLectureAutoSchema;
export type ResultatLecture = ResultatLectureAuto;

/** Lit la page ouverte avec les règles de son portail (et les données que la page charge). */
export async function lirePage(
  document: Document,
  url: string,
  registre: Registre,
  charger: ChargeurDonnees,
): Promise<ResultatLecture> {
  const annonce = resoudreAnnonce(url);
  if (annonce === null) return { ok: false, raison: 'hors-annonce' };
  const regles = registre.reglesDuPortail(annonce.portail);
  if (regles === undefined) return { ok: false, raison: 'portail-sans-regles' };
  const capture = await capturerAvecDonnees(document, url, regles, { mode: 'extension', charger });
  return capture === null ? { ok: false, raison: 'hors-annonce' } : { ok: true, capture };
}

type Recuperer = (adresse: string, init: RequestInit) => Promise<Response>;

/**
 * Charge une adresse relative sur le portail ouvert, comme la page le ferait (même origine,
 * cookies du visiteur). Refuse toute adresse qui sortirait du portail.
 */
export function chargeurDuPortail(recuperer: Recuperer, origine: string): ChargeurDonnees {
  return async (adresse) => {
    const cible = new URL(adresse, origine);
    if (cible.origin !== origine) throw new Error('adresse hors du portail');
    const reponse = await recuperer(cible.href, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!reponse.ok) throw new Error(`HTTP ${String(reponse.status)}`);
    return (await reponse.json()) as unknown;
  };
}
