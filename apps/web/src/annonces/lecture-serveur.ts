import { capturerAvecDonnees, type Capture, type Registre } from '@loupe/capture';

import type { ClientWorker } from '@/enrichissement/client';

import { REGISTRE_WEB } from './regles';

/**
 * Pourquoi la lecture par le serveur n'a rien donné. `indisponible` : pas de lecture serveur
 * (Worker sans clé, hors ligne, ou d'une version sans la route) ; l'écran revient alors à l'invitation.
 */
export type RaisonEchecServeur =
  'indisponible' | 'introuvable' | 'bloquee' | 'limite' | 'reseau' | 'vide' | 'annulee';

export type ResultatLectureServeur =
  | { readonly ok: true; readonly capture: Capture }
  | { readonly ok: false; readonly raison: RaisonEchecServeur };

export interface OptionsLectureServeur {
  readonly signal?: AbortSignal | undefined;
  readonly registre?: Registre | undefined;
  /** HTML → document inerte (aucun script exécuté, aucune image chargée). */
  readonly analyser?: ((html: string) => Document) | undefined;
  readonly maintenant?: (() => Date) | undefined;
}

const RAISONS: Readonly<Record<string, RaisonEchecServeur>> = {
  LECTURE_INDISPONIBLE: 'indisponible',
  HORS_LIGNE: 'indisponible',
  // Un Worker d'avant la route /lecture répond 404 INTROUVABLE.
  INTROUVABLE: 'indisponible',
  HTTP_404: 'indisponible',
  // Page servie depuis une adresse que le Worker ne connaît pas (autre port en développement).
  ORIGINE_REFUSEE: 'indisponible',
  ANNONCE_INTROUVABLE: 'introuvable',
  TROP_DE_REQUETES: 'limite',
  RESEAU: 'reseau',
};

/** Un code du Worker → ce que l'écran en dit ; tout autre échec (fournisseur, page vide, réponse forgée) : lecture bloquée. */
export function raisonDuCode(code: string): RaisonEchecServeur {
  return RAISONS[code] ?? 'bloquee';
}

function analyserHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * Lit une annonce sans extension : le Worker rapporte la page (ou les données Bien'ici), le
 * navigateur y applique les règles de l'extension. Le HTML n'est gardé qu'en mémoire. Ne lève jamais.
 */
export async function lireParServeur(
  url: string,
  client: ClientWorker,
  options: OptionsLectureServeur = {},
): Promise<ResultatLectureServeur> {
  const reponse = await client.lirePage(url, options.signal);
  if (options.signal?.aborted === true) return { ok: false, raison: 'annulee' };
  if (!reponse.ok) return { ok: false, raison: raisonDuCode(reponse.code) };
  const { portail, page, url: urlLue } = reponse.valeur;
  const regles = (options.registre ?? REGISTRE_WEB).reglesDuPortail(portail);
  if (regles === undefined) return { ok: false, raison: 'bloquee' };
  const document = (options.analyser ?? analyserHtml)(page.type === 'html' ? page.html : '');
  const capture = await capturerAvecDonnees(document, urlLue, regles, {
    mode: 'serveur',
    maintenant: options.maintenant?.(),
    charger: () =>
      page.type === 'donnees'
        ? Promise.resolve(page.donnees)
        : Promise.reject(new Error('pas de données chargées')),
  });
  if (capture === null || (capture.prix === undefined && capture.surface === undefined)) {
    return { ok: false, raison: 'vide' };
  }
  return { ok: true, capture };
}
