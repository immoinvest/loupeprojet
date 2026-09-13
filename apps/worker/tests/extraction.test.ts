import { describe, expect, it } from 'vitest';

import { dependancesDepuisEnv } from '../src/dependances';
import { ErreurAmontInvalide, ErreurConfiguration } from '../src/erreurs';
import {
  diagnostic,
  extracteurChat,
  extraireJson,
  messagesPour,
  MODELE_DEFAUT,
  NOMS_CHAMPS,
  normaliserChamps,
  normaliserTexte,
  VERSION_PROMPT,
} from '../src/extraction';
import { journalMemoire } from '../src/journal';
import { ANNONCE, banc, corpsJson, extracteurFixe, REPONSE_MODELE, reponseJson } from './aide';

describe('contrat : normalisation des champs', () => {
  it('garde les valeurs valides, coerce les nombres écrits en texte, ignore les clés inconnues', () => {
    const n = normaliserChamps({ ...REPONSE_MODELE, prix: '155000', inconnu: 'x' });
    expect(n.rejetes).toEqual([]);
    expect(n.champs).toEqual(REPONSE_MODELE);
    expect(Object.keys(n.champs)).toEqual([...NOMS_CHAMPS]);
  });

  it('remplace par null les clés absentes et les valeurs hors contrat, sans rejeter le reste', () => {
    const n = normaliserChamps({ prix: 12, etage: 3, dpe: 'Z', ascenseur: 'oui', ville: 'Lyon' });
    expect(n.champs.prix).toBeNull();
    expect(n.champs.etage).toBe(3);
    expect(n.champs.dpe).toBeNull();
    expect(n.champs.ascenseur).toBeNull();
    expect(n.champs.ville).toBe('Lyon');
    expect(n.champs.surface).toBeNull();
    expect(n.rejetes).toEqual(['prix', 'ascenseur', 'dpe']);
  });

  it('refuse ce qui n’est pas un objet', () => {
    expect(() => normaliserChamps(null)).toThrow(ErreurAmontInvalide);
    expect(() => normaliserChamps('texte')).toThrow(ErreurAmontInvalide);
    expect(() => normaliserChamps([1])).toThrow(ErreurAmontInvalide);
  });
});

describe('prompt', () => {
  it('normalise le texte et construit deux messages', () => {
    expect(normaliserTexte('  a \n\n b\t c ')).toBe('a b c');
    const m = messagesPour('texte annonce');
    expect(m).toHaveLength(2);
    expect(m[0]?.role).toBe('system');
    expect(m[0]?.content).toContain('chargesCoproMois');
    expect(m[0]?.content).toContain('null');
    expect(m[1]).toEqual({ role: 'user', content: 'texte annonce' });
    expect(VERSION_PROMPT).toBe(2);
  });
});

describe('extraireJson', () => {
  it('lit un objet nu, entre clôtures de code ou après un bloc de réflexion', () => {
    expect(extraireJson('{"a":1}')).toEqual({ a: 1 });
    expect(extraireJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(
      extraireJson('<think>je réfléchis {beaucoup}</think>\nVoici : {"a":{"b":2}} merci'),
    ).toEqual({ a: { b: 2 } });
  });

  it('lève ErreurAmontInvalide sans objet ou avec un JSON cassé', () => {
    expect(() => extraireJson('rien')).toThrow(/aucun objet JSON/);
    expect(() => extraireJson('}{')).toThrow(/aucun objet JSON/);
    expect(() => extraireJson('{"a":}')).toThrow(/JSON illisible/);
  });
});

describe('POST /extract', () => {
  it('lit l’annonce, normalise, met en cache 30 jours, ne journalise pas le texte', async () => {
    const extracteur = extracteurFixe();
    const { requete, journal, horloge } = banc({ extracteur });
    const r = await requete('/extract', corpsJson({ texte: ANNONCE }));
    expect(r.status).toBe(200);
    expect(r.headers.get('x-loupe-cache')).toBe('MISS');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({
      champs: REPONSE_MODELE,
      rejetes: [],
      modele: 'modele-test',
      obtenuLe: '2026-09-13T10:00:00.000Z',
    });
    expect(extracteur.appels).toEqual([ANNONCE]);

    horloge.valeur += 29 * 24 * 3_600_000;
    const bis = await requete(
      '/extract',
      corpsJson({ texte: `  ${ANNONCE.replace(' ', '\n\n')} ` }),
    );
    expect(bis.headers.get('x-loupe-cache')).toBe('HIT');
    expect(extracteur.appels).toHaveLength(1);

    horloge.valeur += 2 * 24 * 3_600_000;
    const ter = await requete('/extract', corpsJson({ texte: ANNONCE }));
    expect(ter.headers.get('x-loupe-cache')).toBe('MISS');
    expect(extracteur.appels).toHaveLength(2);
    expect(JSON.stringify(journal.evenements)).not.toContain('Marseille');
  });

  it('valide le corps : JSON illisible, texte absent, trop court', async () => {
    const { requete } = banc();
    const illisible = await requete('/extract', corpsJson('{pas du json'));
    expect(illisible.status).toBe(400);
    expect(await illisible.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['corps'] },
    });
    const sansTexte = await requete('/extract', corpsJson({ autre: 1 }));
    expect(await sansTexte.json()).toEqual({
      code: 'PARAMETRES_INVALIDES',
      details: { champs: ['texte'] },
    });
    const court = await requete('/extract', corpsJson({ texte: 'trop court' }));
    expect(court.status).toBe(400);
    expect((await requete('/extract')).status).toBe(404);
  });

  it('sans clé configurée, répond 503 EXTRACTION_INDISPONIBLE et /health le montre', async () => {
    const { requete } = banc({ extracteur: null });
    const r = await requete('/extract', corpsJson({ texte: ANNONCE }));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'EXTRACTION_INDISPONIBLE' });
    const sante = await (await requete('/health')).json<{ extraction: unknown }>();
    expect(sante.extraction).toBeNull();
  });

  it('transmet les erreurs du fournisseur et signale une réponse hors contrat', async () => {
    const sature = banc({
      extracteur: extracteurFixe({ ok: false, statut: 503, code: 'AMONT_SATURE' }),
    });
    const r = await sature.requete('/extract', corpsJson({ texte: ANNONCE }));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'AMONT_SATURE' });

    const horsContrat = banc({ extracteur: extracteurFixe({ ok: true, brut: [1, 2] }) });
    const h = await horsContrat.requete('/extract', corpsJson({ texte: ANNONCE }));
    expect(h.status).toBe(502);
    expect(await h.json()).toEqual({ code: 'AMONT_INVALIDE' });
    expect(horsContrat.journal.evenements[0]?.evenement).toBe('extraction.invalide');
  });

  it('journalise les champs écartés, sans leur valeur', async () => {
    const { requete, journal } = banc({
      extracteur: extracteurFixe({ ok: true, brut: { prix: 'cher', surface: 65 } }),
    });
    const r = await requete('/extract', corpsJson({ texte: ANNONCE }));
    const corps = await r.json<{ champs: Record<string, unknown>; rejetes: string[] }>();
    expect(corps.champs.surface).toBe(65);
    expect(corps.champs.prix).toBeNull();
    expect(corps.rejetes).toEqual(['prix']);
    expect(journal.evenements).toEqual([
      {
        niveau: 'info',
        evenement: 'extraction.champs_rejetes',
        donnees: { modele: 'modele-test', champs: ['prix'] },
      },
    ]);
  });

  it('a sa propre limite de débit, indépendante du proxy', async () => {
    const { requete } = banc({}, 1);
    expect((await requete('/extract', corpsJson({ texte: ANNONCE }))).status).toBe(200);
    expect((await requete('/extract', corpsJson({ texte: ANNONCE }))).status).toBe(429);
    expect((await requete('/proxy/geocodage?q=8+bd+du+port+amiens')).status).toBe(200);
  });

  it('accepte la préparation CORS d’un POST avec Content-Type', async () => {
    const { requete } = banc();
    const options = await requete('/extract', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(options.status).toBe(204);
    expect(options.headers.get('access-control-allow-methods')).toContain('POST');
    expect(options.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'content-type',
    );
  });
});

describe('fournisseur chat completions', () => {
  const config = {
    url: 'https://llm.test/v1/chat/completions',
    modele: 'modele/x',
    cle: 'secret',
    delaiMs: 1000,
  };

  it('envoie la requête OpenAI-compatible et lit le JSON du premier choix', async () => {
    const requetes: { url: string; init: Record<string, unknown> }[] = [];
    const journal = journalMemoire();
    const extracteur = extracteurChat(
      config,
      (url, init) => {
        requetes.push({ url: url.toString(), init });
        return Promise.resolve(
          reponseJson({
            id: 'x',
            choices: [
              { message: { role: 'assistant', content: '```json\n{"prix": 155000}\n```' } },
            ],
          }),
        );
      },
      journal,
    );
    expect(extracteur.modele).toBe('modele/x');
    expect(await extracteur.extraire(ANNONCE)).toEqual({ ok: true, brut: { prix: 155000 } });
    expect(requetes).toHaveLength(1);
    expect(requetes[0]?.url).toBe(config.url);
    expect(requetes[0]?.init.method).toBe('POST');
    const entetes = requetes[0]?.init.headers as Record<string, string>;
    expect(entetes.authorization).toBe('Bearer secret');
    expect(entetes['content-type']).toBe('application/json');
    const corps = JSON.parse(String(requetes[0]?.init.body)) as Record<string, unknown>;
    expect(corps.model).toBe('modele/x');
    expect(corps.temperature).toBe(0);
    expect(corps.response_format).toEqual({ type: 'json_object' });
    expect(corps.messages).toEqual(messagesPour(ANNONCE));
    expect(journal.evenements).toEqual([]);
  });

  it('traduit les échecs : injoignable, saturé, clé refusée, erreur, réponse illisible', async () => {
    const cas: {
      fetcher: () => Promise<Response>;
      statut: number;
      code: string;
      evenement: string;
    }[] = [
      {
        fetcher: () => Promise.reject(new Error('délai')),
        statut: 502,
        code: 'AMONT_INDISPONIBLE',
        evenement: 'llm.injoignable',
      },
      {
        fetcher: () => Promise.resolve(reponseJson({}, 429)),
        statut: 503,
        code: 'AMONT_SATURE',
        evenement: 'llm.sature',
      },
      {
        fetcher: () => Promise.resolve(reponseJson({}, 401)),
        statut: 503,
        code: 'EXTRACTION_INDISPONIBLE',
        evenement: 'llm.cle_refusee',
      },
      {
        fetcher: () => Promise.resolve(reponseJson({}, 500)),
        statut: 502,
        code: 'AMONT_INDISPONIBLE',
        evenement: 'llm.erreur',
      },
      {
        fetcher: () => Promise.resolve(new Response('<html>', { status: 200 })),
        statut: 502,
        code: 'AMONT_INVALIDE',
        evenement: 'llm.invalide',
      },
      {
        fetcher: () => Promise.resolve(reponseJson({ choices: [] })),
        statut: 502,
        code: 'AMONT_INVALIDE',
        evenement: 'llm.invalide',
      },
      {
        fetcher: () => Promise.resolve(reponseJson({ choices: [{ message: { content: null } }] })),
        statut: 502,
        code: 'AMONT_INVALIDE',
        evenement: 'llm.invalide',
      },
    ];
    for (const c of cas) {
      const journal = journalMemoire();
      const extracteur = extracteurChat(config, c.fetcher, journal);
      expect(await extracteur.extraire(ANNONCE)).toEqual({
        ok: false,
        statut: c.statut,
        code: c.code,
      });
      expect(journal.evenements.map((e) => e.evenement)).toEqual([c.evenement]);
      expect(JSON.stringify(journal.evenements)).not.toContain('secret');
      expect(JSON.stringify(journal.evenements)).not.toContain('Marseille');
    }
  });
});

describe('diagnostic d’une réponse inexploitable', () => {
  it('décrit la forme de la réponse sans en recopier le contenu', () => {
    expect(diagnostic('texte')).toEqual({ type: 'string' });
    expect(diagnostic(null)).toEqual({ type: 'object' });
    expect(diagnostic({ error: { code: 429, message: 'x'.repeat(300) }, choices: 'non' })).toEqual({
      cles: ['error', 'choices'],
      erreur: { code: 429, message: 'x'.repeat(200) },
      choix: 0,
    });
    expect(diagnostic({ error: 'brut', choices: [null] })).toEqual({
      cles: ['error', 'choices'],
      choix: 1,
    });
    expect(
      diagnostic({
        choices: [
          {
            finish_reason: 'length',
            message: { role: 'assistant', content: 'abc', reasoning: 'r' },
          },
        ],
      }),
    ).toEqual({
      cles: ['choices'],
      choix: 1,
      fin: 'length',
      clesMessage: ['role', 'content', 'reasoning'],
      longueurContenu: 3,
    });
    expect(diagnostic({ error: { message: 42 }, choices: [{ message: 'non' }] })).toEqual({
      cles: ['error', 'choices'],
      erreur: { code: undefined, message: undefined },
      choix: 1,
      fin: undefined,
      clesMessage: [],
      longueurContenu: null,
    });
  });

  it('accompagne llm.invalide quand la réponse HTTP est lisible mais hors format', async () => {
    const journal = journalMemoire();
    const extracteur = extracteurChat(
      { url: 'https://llm.test/v1/chat/completions', modele: 'm', cle: 'secret', delaiMs: 1000 },
      () => Promise.resolve(reponseJson({ error: { message: 'No endpoints found', code: 404 } })),
      journal,
    );
    expect(await extracteur.extraire(ANNONCE)).toEqual({
      ok: false,
      statut: 502,
      code: 'AMONT_INVALIDE',
    });
    expect(journal.evenements[0]?.donnees).toMatchObject({
      diagnostic: {
        cles: ['error'],
        erreur: { code: 404, message: 'No endpoints found' },
        choix: 0,
      },
    });
  });
});

describe('dépendances : extracteur depuis l’environnement', () => {
  const kv = { get: () => Promise.resolve(null), put: () => Promise.resolve() };
  const limiteur = { limit: () => Promise.resolve({ success: true }) };
  const base = {
    KV_CACHE: kv,
    LIMITEUR: limiteur,
    LIMITEUR_EXTRACTION: limiteur,
    DONNEES: { get: () => Promise.resolve(null) },
  };

  it('sans clé (absente ou vide) : pas d’extracteur ; avec clé : modèle par défaut ou réglé', () => {
    expect(dependancesDepuisEnv(base).extracteur).toBeNull();
    expect(dependancesDepuisEnv({ ...base, OPENROUTER_API_KEY: '  ' }).extracteur).toBeNull();
    const defaut = dependancesDepuisEnv({ ...base, OPENROUTER_API_KEY: 'k' });
    expect(defaut.extracteur?.modele).toBe(MODELE_DEFAUT);
    expect(defaut.limiteurExtraction).toBe(limiteur);
    const regle = dependancesDepuisEnv({
      ...base,
      OPENROUTER_API_KEY: 'k',
      LLM_MODELE: 'google/gemma-4-31b-it:free',
      LLM_URL: 'https://api.mistral.ai/v1/chat/completions',
    });
    expect(regle.extracteur?.modele).toBe('google/gemma-4-31b-it:free');
  });

  it('refuse une URL de fournisseur invalide', () => {
    expect(() => dependancesDepuisEnv({ ...base, LLM_URL: 'pas une url' })).toThrow(
      ErreurConfiguration,
    );
  });
});
