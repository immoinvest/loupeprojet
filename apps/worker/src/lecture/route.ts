import { resoudreAnnonce, type AnnonceResolue, type Portail } from '@loupe/capture/portails';
import type { Context, Handler } from 'hono';
import type { BlankEnv } from 'hono/types';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

import { origineAutorisee } from '../cors';
import type { Dependances } from '../dependances';
import { reponseErreur, type CodeErreur } from '../erreurs';
import { lireDonneesBienici } from './bienici';
import type { LecteurPages } from './fournisseur';

/** Le corps ne porte qu'une URL. */
export const TAILLE_MAX_CORPS = 2_048;
export const TENTATIVES_MAX = 2;
/** Pas de seconde tentative si la première a déjà duré plus longtemps. */
export const DUREE_MAX_AVANT_NOUVELLE_TENTATIVE_MS = 75_000;

/**
 * Ce qui prouve qu'une page porte les données de l'annonce (règles de `apps/extension/regles`) :
 * une page vide ou un écran de vérification anti-robot ne les a pas.
 */
export const MARQUEURS: Readonly<Record<Exclude<Portail, 'bienici'>, string>> = {
  leboncoin: '__NEXT_DATA__',
  seloger: '__UFRN_LIFECYCLE_SERVERREQUEST__',
  logicimmo: '__UFRN_LIFECYCLE_SERVERREQUEST__',
  pap: 'application/ld+json',
};

const RequeteLectureSchema = z.object({ url: z.string().min(1).max(2_000) });

type Page =
  | { readonly type: 'html'; readonly html: string }
  | { readonly type: 'donnees'; readonly donnees: Readonly<Record<string, unknown>> };

type Issue =
  | { readonly ok: true; readonly page: Page; readonly tentatives: number }
  | {
      readonly ok: false;
      readonly statut: ContentfulStatusCode;
      readonly code: CodeErreur;
      readonly tentatives: number;
    };

function analyserCorps(texte: string): unknown {
  try {
    return JSON.parse(texte) as unknown;
  } catch {
    return undefined;
  }
}

async function lireBienici(deps: Dependances, annonce: AnnonceResolue): Promise<Issue> {
  const lu = await lireDonneesBienici(annonce.id, deps.fetcher);
  if (lu.ok) return { ok: true, page: { type: 'donnees', donnees: lu.donnees }, tentatives: 1 };
  const statut = lu.code === 'ANNONCE_INTROUVABLE' ? 404 : 502;
  return { ok: false, statut, code: lu.code, tentatives: 1 };
}

/** Jusqu'à deux lectures : la seconde seulement si la première n'a rien rapporté d'exploitable et a été rapide. */
async function lireParFournisseur(
  lecteur: LecteurPages,
  annonce: AnnonceResolue & { readonly portail: Exclude<Portail, 'bienici'> },
  maintenant: () => number,
): Promise<Issue> {
  const debut = maintenant();
  let tentatives = 0;
  while (tentatives < TENTATIVES_MAX) {
    tentatives += 1;
    const page = await lecteur.lire(annonce.urlCanonique);
    if (!page.ok) return { ok: false, statut: 502, code: page.code, tentatives };
    if (page.statutPortail === 404 || page.statutPortail === 410) {
      return { ok: false, statut: 404, code: 'ANNONCE_INTROUVABLE', tentatives };
    }
    if (page.statutPortail < 400 && page.html.includes(MARQUEURS[annonce.portail])) {
      return { ok: true, page: { type: 'html', html: page.html }, tentatives };
    }
    if (maintenant() - debut >= DUREE_MAX_AVANT_NOUVELLE_TENTATIVE_MS) break;
  }
  return { ok: false, statut: 502, code: 'AMONT_VIDE', tentatives };
}

function lire(deps: Dependances, annonce: AnnonceResolue): Promise<Issue> | null {
  if (annonce.portail === 'bienici') return lireBienici(deps, annonce);
  if (deps.lecteurPages === null) return null;
  return lireParFournisseur(deps.lecteurPages, { ...annonce, portail: annonce.portail }, () =>
    deps.maintenant(),
  );
}

function repondre(c: Context, deps: Dependances, annonce: AnnonceResolue, issue: Issue): Response {
  if (!issue.ok) return reponseErreur(issue.statut, issue.code);
  const corps = {
    portail: annonce.portail,
    url: annonce.urlCanonique,
    page: issue.page,
    tentatives: issue.tentatives,
    obtenuLe: new Date(deps.maintenant()).toISOString(),
  };
  return c.body(JSON.stringify(corps), 200, {
    'Content-Type': 'application/json; charset=UTF-8',
    // Le contenu d'une annonce n'est gardé ni par le navigateur, ni par Cloudflare, ni par Deklic.
    'Cache-Control': 'no-store',
  });
}

type Demande =
  | { readonly ok: true; readonly annonce: AnnonceResolue }
  | { readonly ok: false; readonly reponse: Response };

/**
 * Qui demande, et quoi. Chaque lecture coûte une requête au fournisseur : seules les pages de
 * Deklic peuvent la demander, pour une annonce en https d'un des cinq portails, avec un corps court
 * dont la taille est vérifiée avant d'être lu.
 */
async function lireDemande(c: Context, deps: Dependances): Promise<Demande> {
  const origine = c.req.header('Origin');
  if (origine === undefined || !origineAutorisee(origine, deps.origines)) {
    return { ok: false, reponse: reponseErreur(403, 'ORIGINE_REFUSEE') };
  }
  const refusCorps = {
    ok: false,
    reponse: reponseErreur(400, 'PARAMETRES_INVALIDES', { champs: ['corps'] }),
  } as const;
  if (Number(c.req.header('Content-Length') ?? '0') > TAILLE_MAX_CORPS) return refusCorps;
  const texte = await c.req.text();
  const corps = texte.length > TAILLE_MAX_CORPS ? undefined : analyserCorps(texte);
  if (corps === undefined) return refusCorps;
  const requete = RequeteLectureSchema.safeParse(corps);
  const annonce = requete.success ? resoudreAnnonce(requete.data.url) : null;
  if (annonce?.urlCanonique.startsWith('https://') !== true) {
    return { ok: false, reponse: reponseErreur(400, 'PARAMETRES_INVALIDES', { champs: ['url'] }) };
  }
  return { ok: true, annonce };
}

/**
 * POST /lecture { url } : récupère la page d'une annonce des cinq portails, à la demande de la
 * personne (ADR-008). Rien n'est mis en cache ni journalisé du contenu.
 */
export function creerLecture(deps: Dependances): Handler<BlankEnv, '/lecture'> {
  return async (c) => {
    const demande = await lireDemande(c, deps);
    if (!demande.ok) return demande.reponse;
    const { annonce } = demande;

    const debut = deps.maintenant();
    const enCours = lire(deps, annonce);
    if (enCours === null) return reponseErreur(503, 'LECTURE_INDISPONIBLE');
    const issue = await enCours;
    deps.journal.info('lecture.terminee', {
      portail: annonce.portail,
      resultat: issue.ok ? 'ok' : issue.code,
      tentatives: issue.tentatives,
      dureeMs: deps.maintenant() - debut,
      octets: issue.ok && issue.page.type === 'html' ? issue.page.html.length : null,
    });
    return repondre(c, deps, annonce, issue);
  };
}
