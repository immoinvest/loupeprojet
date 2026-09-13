import { SOURCE_EXTENSION, SOURCE_WEB, type MessageWeb } from '@loupe/capture';
import { describe, expect, it } from 'vitest';

import {
  DELAI_LECTURE_MS,
  DELAI_PING_MS,
  detecterExtension,
  lireParExtension,
  type FenetreDeklic,
} from '@/annonces/extension';
import { texteEchecLecture } from '@/textes/lecture-auto';

const ORIGINE = 'https://loupeprojet.pages.dev';
const URL_PAP = 'https://www.pap.fr/annonces/appartement-marseille-13005-r456789012';
const CAPTURE = { version: 1, portail: 'pap', url: URL_PAP, captureLe: '2026-09-13T10:41:00.000Z' };

type Repondeur = (
  message: MessageWeb,
  emettre: (data: unknown, surcharge?: object) => void,
) => void;

/** Une page Deklic en mémoire ; `repondre` joue le rôle du script « pont » de l'extension. */
function fenetre(repondre: Repondeur | null): FenetreDeklic & { ecouteurs: number } {
  const ecouteurs = new Set<(e: MessageEvent) => void>();
  const page: FenetreDeklic & { ecouteurs: number } = {
    location: { origin: ORIGINE },
    get ecouteurs() {
      return ecouteurs.size;
    },
    addEventListener: (_type, ecouteur) => {
      ecouteurs.add(ecouteur);
    },
    removeEventListener: (_type, ecouteur) => {
      ecouteurs.delete(ecouteur);
    },
    postMessage: (message) => {
      const emettre = (data: unknown, surcharge: object = {}): void => {
        const evenement = {
          data,
          origin: ORIGINE,
          source: page,
          ...surcharge,
        } as unknown as MessageEvent;
        for (const ecouteur of [...ecouteurs]) ecouteur(evenement);
      };
      queueMicrotask(() => {
        repondre?.(message, emettre);
      });
    },
  };
  return page;
}

describe('detecterExtension', () => {
  it('reconnaît l’extension qui répond au ping, et se désabonne ensuite', async () => {
    const page = fenetre((message, emettre) => {
      emettre({ source: SOURCE_EXTENSION, type: 'pong', id: message.id, version: 1 });
    });
    expect(await detecterExtension(page)).toBe(true);
    expect(page.ecouteurs).toBe(0);
    expect(DELAI_PING_MS).toBeLessThanOrEqual(1_000);
  });

  it('conclut à l’absence quand personne ne répond, ou seulement des messages étrangers', async () => {
    expect(await detecterExtension(fenetre(null), 5)).toBe(false);
    const bruit = fenetre((message, emettre) => {
      emettre({ source: SOURCE_EXTENSION, type: 'pong', id: 'autre-id', version: 1 });
      emettre(
        { source: SOURCE_EXTENSION, type: 'pong', id: message.id, version: 1 },
        { origin: 'https://pirate.example' },
      );
      emettre(
        { source: SOURCE_EXTENSION, type: 'pong', id: message.id, version: 1 },
        { source: {} },
      );
      emettre('pas un message');
    });
    expect(await detecterExtension(bruit, 20)).toBe(false);
  });
});

describe('lireParExtension', () => {
  it('rend le résultat de la lecture demandée', async () => {
    const envoyes: MessageWeb[] = [];
    const page = fenetre((message, emettre) => {
      envoyes.push(message);
      emettre({
        source: SOURCE_EXTENSION,
        type: 'resultat',
        id: message.id,
        resultat: { ok: true, capture: CAPTURE },
      });
    });
    expect(await lireParExtension(page, URL_PAP)).toEqual({ ok: true, capture: CAPTURE });
    expect(envoyes[0]).toMatchObject({ source: SOURCE_WEB, type: 'lire', url: URL_PAP });
    expect(DELAI_LECTURE_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('vaut échec de chargement sans réponse, ou si l’extension répond autre chose', async () => {
    expect(await lireParExtension(fenetre(null), URL_PAP, 5)).toEqual({
      ok: false,
      raison: 'chargement',
    });
    const pong = fenetre((message, emettre) => {
      emettre({ source: SOURCE_EXTENSION, type: 'pong', id: message.id, version: 1 });
    });
    expect(await lireParExtension(pong, URL_PAP, 1_000)).toEqual({
      ok: false,
      raison: 'chargement',
    });
  });
});

describe('texteEchecLecture', () => {
  it('a une phrase pour chaque raison, avec la marche à suivre', () => {
    const phrases = (
      ['hors-annonce', 'portail-sans-regles', 'permission', 'chargement', 'vide', 'occupe'] as const
    ).map(texteEchecLecture);
    expect(new Set(phrases).size).toBe(6);
    expect(texteEchecLecture('permission')).toMatch(/Autoriser la lecture automatique/);
    expect(texteEchecLecture('vide')).toMatch(/Collez le texte/);
  });
});
