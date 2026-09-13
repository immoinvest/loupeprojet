import type { Capture } from '@loupe/capture';
import { ProjetSchema } from '@loupe/moteur';
import { describe, expect, it, vi } from 'vitest';

import { construireProjet, importerCapture, type SaisieProjet } from '@/annonces';
import {
  clientHorsLigne,
  completerAvecIa,
  enrichirSaisie,
  type ClientWorker,
  type Resultat,
} from '@/enrichissement';

const ok = <T>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });

const CAPTURE: Capture = {
  version: 1,
  portail: 'bienici',
  url: 'https://www.bienici.com/annonce/vente/marseille-5e/appartement/3pieces/ag13-123456',
  captureLe: '2026-09-13T10:41:00.000Z',
  typeBien: 'maison',
  prix: 155_000,
  surface: 65,
  pieces: 3,
  ges: 'B',
  codePostal: '13005',
  ville: 'Marseille 5e',
  lotsCopro: 24,
  coproEnProcedure: false,
  description:
    'Maison T3 de 62 m² au calme. Taxe foncière : 1 050 €. Honoraires charge acquéreur : 7 000 € inclus.',
  mode: 'extension',
};

const IA = {
  prix: 150_000,
  surface: 62,
  pieces: null,
  chambres: 2,
  etage: 0,
  ascenseur: false,
  dpe: 'D' as const,
  codePostal: null,
  ville: null,
  annee: 1962,
  chargesCoproMois: 90,
  taxeFonciere: 1_050,
  honorairesAgence: 7_000,
  meuble: null,
};

describe('importerCapture', () => {
  it('sépare les champs de la page de ceux lus dans le texte, et garde le texte en mémoire', () => {
    const importee = importerCapture(CAPTURE);
    expect(importee.champsPage).toMatchObject({
      typeBien: 'maison',
      surface: 65,
      ges: 'B',
      lotsCopro: 24,
    });
    expect(importee.champsPage.taxeFonciere).toBeUndefined();
    expect(importee.champs).toMatchObject({
      surface: 65,
      taxeFonciere: 1_050,
      honorairesAgence: 7_000,
    });
    expect(importee.description).toMatch(/Maison T3/);
    expect(importee.mode).toBe('extension');
  });
});

describe('completerAvecIa', () => {
  it('l’IA comble les trous ; les données de la page restent prioritaires', async () => {
    const extraire = vi.fn(() => ok(IA));
    const client: ClientWorker = { ...clientHorsLigne, extraire };
    const { capture, mode } = await completerAvecIa(importerCapture(CAPTURE), client);
    expect(mode).toBe('ia');
    expect(extraire).toHaveBeenCalledWith(CAPTURE.description);
    expect(capture.champs).toMatchObject({
      prix: 155_000,
      surface: 65,
      pieces: 3,
      typeBien: 'maison',
      chambres: 2,
      etage: 0,
      dpe: 'D',
      annee: 1962,
      chargesCoproMois: 90,
      honorairesAgence: 7_000,
    });
  });

  it('ne dérange pas l’IA sans texte ou quand rien ne manque, et garde la capture si le Worker ne répond pas', async () => {
    const extraire = vi.fn(() => ok(IA));
    const client: ClientWorker = { ...clientHorsLigne, extraire };
    const sansTexte = importerCapture({ ...CAPTURE, description: undefined });
    expect(await completerAvecIa(sansTexte, client)).toEqual({ capture: sansTexte, mode: null });

    const complete = importerCapture({
      ...CAPTURE,
      etage: 1,
      ascenseur: true,
      dpe: 'C',
      anneeConstruction: 1990,
      chargesCopro: 80,
      taxeFonciere: 900,
    });
    expect((await completerAvecIa(complete, client)).mode).toBeNull();
    expect(extraire).not.toHaveBeenCalled();

    const hors = importerCapture(CAPTURE);
    expect(await completerAvecIa(hors, clientHorsLigne)).toEqual({ capture: hors, mode: null });
  });
});

const SAISIE: SaisieProjet = {
  prix: 155_000,
  surface: 65,
  codePostal: '13005',
  ville: 'Marseille',
  mode: 'meuble_lld',
  loyerHc: 980,
  apport: 15_000,
  dureeAnnees: 25,
  tmi: 0.3,
  revenusMensuels: 2_600,
  provenance: { typeBien: 'annonce', ges: 'annonce', lotsCopro: 'annonce' },
};

describe('construireProjet · type, GES et copropriété', () => {
  it('reprend le type de bien, le GES, les lots et la procédure avec leur provenance', () => {
    const projet = construireProjet(
      { ...SAISIE, typeBien: 'maison', ges: 'B', lotsCopro: 24, coproEnProcedure: true },
      'p1',
    );
    expect(projet.bien).toMatchObject({
      type: 'maison',
      ges: 'B',
      copro: { lots: 24, procedure: true },
    });
    expect(projet.provenance).toMatchObject({
      'bien.type': 'annonce',
      'bien.ges': 'annonce',
      'bien.copro.lots': 'annonce',
      'bien.copro.procedure': 'utilisateur',
    });
    expect(ProjetSchema.safeParse(projet).success).toBe(true);
  });

  it('appartement et pas de copropriété par défaut ; lots ou procédure seuls', () => {
    const defaut = construireProjet(SAISIE, 'p2');
    expect(defaut.bien.type).toBe('appartement');
    expect(defaut.bien.copro).toBeUndefined();
    expect(construireProjet({ ...SAISIE, lotsCopro: 8 }, 'p3').bien.copro).toEqual({ lots: 8 });
    expect(
      construireProjet({ ...SAISIE, coproEnProcedure: false, provenance: {} }, 'p4').bien.copro,
    ).toEqual({ procedure: false });
  });

  it('marque « à toi » le GES et les lots saisis sans provenance', () => {
    const projet = construireProjet({ ...SAISIE, ges: 'C', lotsCopro: 3, provenance: {} }, 'p5');
    expect(projet.provenance).toMatchObject({
      'bien.ges': 'utilisateur',
      'bien.copro.lots': 'utilisateur',
    });
  });
});

describe('enrichirSaisie · type de bien', () => {
  it('demande le marché des maisons pour une maison', async () => {
    const marche = vi.fn(() => Promise.resolve({ ok: false as const, code: 'INDISPONIBLE' }));
    const client: ClientWorker = {
      ...clientHorsLigne,
      geocoder: () =>
        ok({
          libelle: 'Marseille',
          lat: 43.3,
          lon: 5.4,
          precision: 'commune',
          codeInsee: '13205',
          codePostal: '13005',
        }),
      marche,
    };
    await enrichirSaisie({ ...SAISIE, typeBien: 'maison' }, client);
    expect(marche).toHaveBeenCalledWith(expect.objectContaining({ type: 'maison' }));
  });
});
