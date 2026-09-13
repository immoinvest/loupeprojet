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
  readonly id: RegExp;
}

const REGLES_URL: readonly RegleUrl[] = [
  { portail: 'leboncoin', hote: /(^|\.)leboncoin\.fr$/, id: /\/(\d{6,})(?:[/?#]|$)/ },
  { portail: 'seloger', hote: /(^|\.)seloger\.com$/, id: /\/(\d{6,})\.htm/ },
  {
    portail: 'bienici',
    hote: /(^|\.)bienici\.com$/,
    id: /\/annonce\/(?:.*\/)?([a-z0-9]+(?:-[a-z0-9]+)*-\d+)\/?$/i,
  },
  { portail: 'pap', hote: /(^|\.)pap\.fr$/, id: /-r(\d{5,})(?:[/?#]|$)/ },
  { portail: 'logicimmo', hote: /(^|\.)logic-immo\.com$/, id: /[-/](\d{6,})(?:\.htm|[/?#]|$)/ },
];

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
  for (const regle of REGLES_URL) {
    if (!regle.hote.test(hote)) continue;
    const id = regle.id.exec(url.pathname)?.[1];
    if (id === undefined) return null;
    return { portail: regle.portail, id, urlCanonique: `${url.origin}${url.pathname}` };
  }
  return null;
}
