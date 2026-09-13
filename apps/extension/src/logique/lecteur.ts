import {
  ResultatLectureAutoSchema,
  resoudreAnnonce,
  type Capture,
  type Portail,
  type Registre,
  type ResultatLectureAuto,
} from '@loupe/capture';

/** L'onglet Deklic qui demande la lecture : le nouvel onglet s'ouvre à côté, on y revient ensuite. */
export interface OngletOrigine {
  readonly tabId?: number | undefined;
  readonly windowId?: number | undefined;
  readonly index?: number | undefined;
}

/** Ce dont la lecture a besoin du navigateur ; `arriere-plan.ts` le branche sur `chrome.*`. */
export interface Navigateur {
  readonly permis: (portail: Portail) => Promise<boolean>;
  readonly ouvrir: (url: string, origine: OngletOrigine) => Promise<number>;
  readonly attendreChargement: (tabId: number, delaiMs: number) => Promise<boolean>;
  readonly lire: (tabId: number) => Promise<unknown>;
  readonly afficher: (tabId: number) => Promise<void>;
  readonly fermer: (tabId: number) => Promise<void>;
  readonly revenir: (origine: OngletOrigine) => Promise<void>;
  readonly dormir: (ms: number) => Promise<void>;
}

export interface Reglages {
  readonly chargementMs: number;
  /** Lectures dans l'onglet caché, espacées de `pauseMs`. */
  readonly essaisCaches: number;
  /** Lectures une fois l'onglet affiché (page qui ne se dessine pas cachée, contrôle anti-robot). */
  readonly essaisAffiches: number;
  readonly pauseMs: number;
}

export const REGLAGES: Reglages = {
  chargementMs: 20_000,
  essaisCaches: 5,
  essaisAffiches: 20,
  pauseMs: 1_000,
};

/** Une capture suffit quand elle a au moins le prix et la surface. */
export function suffisante(capture: Capture): boolean {
  return capture.prix !== undefined && capture.surface !== undefined;
}

function meilleure(a: Capture | null, b: Capture | null): Capture | null {
  if (a === null) return b;
  if (b === null) return a;
  return Object.keys(b).length > Object.keys(a).length ? b : a;
}

async function lireUneFois(nav: Navigateur, tabId: number): Promise<Capture | null> {
  try {
    const lecture = ResultatLectureAutoSchema.safeParse(await nav.lire(tabId));
    return lecture.success && lecture.data.ok ? lecture.data.capture : null;
  } catch {
    // Page d'erreur, onglet en cours de navigation : on réessaiera.
    return null;
  }
}

async function essayer(
  nav: Navigateur,
  tabId: number,
  essais: number,
  pauseAvant: boolean,
  reglages: Reglages,
  depart: Capture | null,
): Promise<Capture | null> {
  let retenue = depart;
  for (let essai = 0; essai < essais; essai += 1) {
    if (essai > 0 || pauseAvant) await nav.dormir(reglages.pauseMs);
    retenue = meilleure(retenue, await lireUneFois(nav, tabId));
    if (retenue !== null && suffisante(retenue)) return retenue;
  }
  return retenue;
}

async function lireDansUnOnglet(
  nav: Navigateur,
  url: string,
  origine: OngletOrigine,
  reglages: Reglages,
): Promise<ResultatLectureAuto> {
  const tabId = await nav.ouvrir(url, origine);
  try {
    const charge = await nav.attendreChargement(tabId, reglages.chargementMs);
    let capture = charge
      ? await essayer(nav, tabId, reglages.essaisCaches, false, reglages, null)
      : null;
    if (capture === null || !suffisante(capture)) {
      await nav.afficher(tabId);
      capture = await essayer(nav, tabId, reglages.essaisAffiches, true, reglages, capture);
    }
    if (capture === null) return { ok: false, raison: charge ? 'vide' : 'chargement' };
    return { ok: true, capture };
  } finally {
    await nav.fermer(tabId);
    await nav.revenir(origine);
  }
}

/**
 * La lecture demandée par Deklic : ouvre l'annonce dans un onglet caché à côté de Deklic, la lit
 * jusqu'à avoir prix et surface, sinon affiche l'onglet et réessaie, puis le referme et revient
 * sur Deklic. Une seule lecture à la fois. Ne lève jamais.
 */
export function creerLecteur(
  nav: Navigateur,
  registre: Registre,
  reglages: Reglages = REGLAGES,
): (url: string, origine: OngletOrigine) => Promise<ResultatLectureAuto> {
  let occupe = false;
  return async (url, origine) => {
    const annonce = resoudreAnnonce(url);
    if (annonce === null) return { ok: false, raison: 'hors-annonce' };
    if (registre.reglesDuPortail(annonce.portail) === undefined) {
      return { ok: false, raison: 'portail-sans-regles' };
    }
    if (occupe) return { ok: false, raison: 'occupe' };
    occupe = true;
    const resultat = await lireSansLever(nav, annonce, origine, reglages);
    occupe = false;
    return resultat;
  };
}

/** Autorisation puis lecture ; toute panne du navigateur devient un échec de chargement. */
async function lireSansLever(
  nav: Navigateur,
  annonce: { readonly portail: Portail; readonly urlCanonique: string },
  origine: OngletOrigine,
  reglages: Reglages,
): Promise<ResultatLectureAuto> {
  try {
    if (!(await nav.permis(annonce.portail))) return { ok: false, raison: 'permission' };
    return await lireDansUnOnglet(nav, annonce.urlCanonique, origine, reglages);
  } catch {
    return { ok: false, raison: 'chargement' };
  }
}
