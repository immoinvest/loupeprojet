import { describe, expect, it } from 'vitest';

import {
  MessageExtensionSchema,
  MessageWebSchema,
  ResultatLectureAutoSchema,
  SOURCE_EXTENSION,
  SOURCE_WEB,
  VERSION_PONT,
} from '../src';

import { CAPTURE_MINIMALE } from './captures';

describe('protocole du pont page ↔ extension', () => {
  it('accepte un ping et une demande de lecture de la page Deklic', () => {
    expect(MessageWebSchema.parse({ source: SOURCE_WEB, type: 'ping', id: 'p1' })).toMatchObject({
      type: 'ping',
    });
    expect(
      MessageWebSchema.parse({
        source: SOURCE_WEB,
        type: 'lire',
        id: 'l1',
        url: 'https://www.pap.fr/annonces/appartement-marseille-13005-r456789012',
      }),
    ).toMatchObject({ type: 'lire' });
  });

  it('ignore les messages étrangers : autre source, type inconnu, URL invalide, identifiant vide', () => {
    expect(MessageWebSchema.safeParse({ source: 'autre', type: 'ping', id: 'p' }).success).toBe(
      false,
    );
    expect(
      MessageWebSchema.safeParse({ source: SOURCE_WEB, type: 'effacer', id: 'p' }).success,
    ).toBe(false);
    expect(
      MessageWebSchema.safeParse({ source: SOURCE_WEB, type: 'lire', id: 'l', url: 'pas une url' })
        .success,
    ).toBe(false);
    expect(MessageWebSchema.safeParse({ source: SOURCE_WEB, type: 'ping', id: '' }).success).toBe(
      false,
    );
    expect(MessageWebSchema.safeParse('ping').success).toBe(false);
  });

  it('valide les réponses de l’extension : pong versionné, résultat avec capture ou raison', () => {
    expect(
      MessageExtensionSchema.parse({
        source: SOURCE_EXTENSION,
        type: 'pong',
        id: 'p1',
        version: VERSION_PONT,
      }),
    ).toMatchObject({ version: 1 });
    expect(
      MessageExtensionSchema.parse({
        source: SOURCE_EXTENSION,
        type: 'resultat',
        id: 'l1',
        resultat: { ok: true, capture: CAPTURE_MINIMALE },
      }),
    ).toMatchObject({ resultat: { ok: true } });
    expect(ResultatLectureAutoSchema.safeParse({ ok: false, raison: 'permission' }).success).toBe(
      true,
    );
    expect(ResultatLectureAutoSchema.safeParse({ ok: false, raison: 'panne' }).success).toBe(false);
    expect(
      ResultatLectureAutoSchema.safeParse({
        ok: true,
        capture: { ...CAPTURE_MINIMALE, version: 2 },
      }).success,
    ).toBe(false);
  });
});
