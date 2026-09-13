import * as z from 'zod';

export const PortailSchema = z.enum(['leboncoin', 'seloger', 'bienici', 'pap', 'logicimmo']);
export type Portail = z.infer<typeof PortailSchema>;

/** Nom de domaine affiché pour chaque portail. */
export const PORTAILS: Readonly<Record<Portail, string>> = {
  leboncoin: 'leboncoin.fr',
  seloger: 'seloger.com',
  bienici: 'bienici.com',
  pap: 'pap.fr',
  logicimmo: 'logic-immo.com',
};

export interface AnnonceResolue {
  readonly portail: Portail;
  readonly id: string;
  readonly urlCanonique: string;
}

interface RegleUrl {
  readonly portail: Portail;
  readonly hote: RegExp;
  /** Formes d'URL d'une annonce, essayées dans l'ordre ; le groupe 1 est l'identifiant. */
  readonly ids: readonly RegExp[];
}

/**
 * Formes relevées le 13/09/2026. SeLoger et Logic-Immo partagent la même plateforme : identifiants
 * alphanumériques en fin d'adresse (`/annonce/achat/…/26FZC3J4KETZ`, `/detail-annonce/…/262H71INQG69`),
 * les anciennes adresses en `…/123456789.htm` restent reconnues. Bien'ici : `apimo-87330295`,
 * `visiteonline-p_6307171`…
 */
const REGLES_URL: readonly RegleUrl[] = [
  { portail: 'leboncoin', hote: /(^|\.)leboncoin\.fr$/, ids: [/\/(\d{6,})(?:[/?#]|$)/] },
  {
    portail: 'seloger',
    hote: /(^|\.)seloger\.com$/,
    ids: [/\/annonces?\/(?:[^/]+\/)*([A-Z0-9]{8,})\/?$/, /\/(\d{6,})\.htm/],
  },
  {
    portail: 'bienici',
    hote: /(^|\.)bienici\.com$/,
    ids: [/\/annonce\/(?:[^/]+\/)+([\w.-]*\d[\w.-]*)\/?$/],
  },
  { portail: 'pap', hote: /(^|\.)pap\.fr$/, ids: [/-r(\d{5,})(?:[/?#]|$)/] },
  {
    portail: 'logicimmo',
    hote: /(^|\.)logic-immo\.com$/,
    ids: [/\/detail-annonce\/(?:[^/]+\/)*([A-Z0-9]{8,})\/?$/, /[-/](\d{6,})(?:\.htm|[/?#]|$)/],
  },
];

function identifiant(regle: RegleUrl, chemin: string): string | undefined {
  for (const forme of regle.ids) {
    const id = forme.exec(chemin)?.[1];
    if (id !== undefined) return id;
  }
  return undefined;
}

/**
 * Reconnaît le portail et l'identifiant d'une annonce depuis son URL ; `null` si ce n'est pas
 * une annonce connue. L'URL canonique ne garde ni paramètres de suivi ni fragment.
 */
export function resoudreAnnonce(texte: string): AnnonceResolue | null {
  let url: URL;
  try {
    url = new URL(texte.trim());
  } catch {
    return null;
  }
  const hote = url.hostname.toLowerCase();
  const regle = REGLES_URL.find((r) => r.hote.test(hote));
  if (regle === undefined) return null;
  const id = identifiant(regle, url.pathname);
  if (id === undefined) return null;
  return { portail: regle.portail, id, urlCanonique: `${url.origin}${url.pathname}` };
}

/** Motifs d'URL des cinq portails, pour les permissions d'hôte de l'extension. */
export const MOTIFS_PORTAILS: Readonly<Record<Portail, string>> = {
  leboncoin: '*://*.leboncoin.fr/*',
  seloger: '*://*.seloger.com/*',
  bienici: '*://*.bienici.com/*',
  pap: '*://*.pap.fr/*',
  logicimmo: '*://*.logic-immo.com/*',
};
