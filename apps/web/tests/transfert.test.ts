import { describe, expect, it } from 'vitest';

import { decisionBascule } from '@/application/bascule';
import { compresserJson } from '@/stockage/compression';
import {
  CLE_TRANSFERT_FAIT,
  decoderTransfert,
  fusionnerTransfert,
  lienTransfert,
  lireFragmentTransfert,
  marquerTransfertFait,
  projetsATransferer,
  transfertDejaFait,
} from '@/stockage/transfert';
import { creerProjet, NOM_PROJET_EXEMPLE, type ProjetEnregistre } from '@/stockage/projets';
import { TEXTES_TRANSFERT } from '@/textes/transfert';

const DIX = '2026-09-15T10:00:00.000Z';
const ONZE = '2026-09-15T11:00:00.000Z';

function projet(id: string, modifieLe = DIX, nom = `Projet ${id}`): ProjetEnregistre {
  return { ...creerProjet({ nom, genererId: () => id, maintenant: () => DIX }), modifieLe };
}

const exemple = (id: string): ProjetEnregistre => projet(id, DIX, NOM_PROJET_EXEMPLE);

describe('lien et décodage du transfert', () => {
  it('emporte les projets (sauf l’exemple intact) et les relit à l’identique', async () => {
    const a = projet('a');
    const b = projet('b', ONZE);
    expect(projetsATransferer([exemple('e'), a, b])).toEqual([a, b]);
    const lien = await lienTransfert('https://app.deklic.pro', [a, b]);
    expect(lien.startsWith('https://app.deklic.pro/transfert#d=')).toBe(true);
    const texte = lireFragmentTransfert(new URL(lien).hash);
    expect(await decoderTransfert(texte ?? '')).toEqual({ ok: true, projets: [a, b], ignores: 0 });
    expect(lireFragmentTransfert('#autre=1')).toBeNull();
  });

  it('écarte les projets invalides en les comptant ; refuse vide, abîmé, enveloppe inconnue', async () => {
    const texte = await compresserJson({ version: 1, projets: [projet('a'), { id: 'x' }] });
    const decodage = await decoderTransfert(texte);
    expect(decodage.ok && decodage.ignores).toBe(1);
    expect(await decoderTransfert(' ')).toEqual({ ok: false, raison: 'vide' });
    expect(await decoderTransfert('%%%')).toEqual({ ok: false, raison: 'illisible' });
    expect(await decoderTransfert(await compresserJson({ version: 2, projets: [] }))).toEqual({
      ok: false,
      raison: 'invalide',
    });
  });
});

describe('fusionnerTransfert', () => {
  it('ajoute les nouveaux, remplace par plus récent, garde une version égale ou plus récente', () => {
    const existants = [projet('a', ONZE), projet('b', DIX), projet('c', DIX)];
    const recus = [projet('a', DIX), projet('b', ONZE), projet('c', DIX), projet('d')];
    const fusion = fusionnerTransfert(existants, recus);
    expect(fusion.projets.map((p) => [p.id, p.modifieLe])).toEqual([
      ['d', DIX],
      ['a', ONZE],
      ['b', ONZE],
      ['c', DIX],
    ]);
    expect(fusion).toMatchObject({
      ajoutes: 1,
      remplaces: 1,
      gardes: 2,
      ecrits: ['b', 'd'],
      retires: [],
    });
  });

  it('retire l’exemple intact posé par l’appareil quand des projets arrivent, pas sinon', () => {
    const local = exemple('local');
    expect(fusionnerTransfert([local], [projet('a')]).retires).toEqual([local]);
    expect(fusionnerTransfert([local], []).retires).toEqual([]);
    // Le même exemple, reçu : il n'est pas retiré.
    expect(fusionnerTransfert([local], [local]).retires).toEqual([]);
  });

  it('marque le transfert fait une seule fois', () => {
    const s = window.localStorage;
    expect(transfertDejaFait(s)).toBe(false);
    marquerTransfertFait(s, DIX);
    expect(s.getItem(CLE_TRANSFERT_FAIT)).toBe(DIX);
    expect(transfertDejaFait(s)).toBe(true);
  });
});

describe('decisionBascule', () => {
  const base = {
    actif: true,
    origineCourante: 'https://loupeprojet.pages.dev',
    origineCible: 'https://app.deklic.pro',
    chemin: '/projets/a?x=1#y',
    aTransferer: false,
  };

  it('reste sans drapeau, hors de l’adresse historique exacte ou sans nouvelle adresse', () => {
    expect(decisionBascule({ ...base, actif: false })).toEqual({ type: 'rester' });
    for (const origineCourante of [
      'https://feat-x.loupeprojet.pages.dev',
      'http://localhost:5173',
      'https://app.deklic.pro',
    ]) {
      expect(decisionBascule({ ...base, origineCourante })).toEqual({ type: 'rester' });
    }
    expect(decisionBascule({ ...base, origineCible: 'https://loupeprojet.pages.dev' })).toEqual({
      type: 'rester',
    });
  });

  it('transfère une fois s’il y a des projets, redirige sinon en gardant la page', () => {
    expect(decisionBascule({ ...base, aTransferer: true })).toEqual({
      type: 'transferer',
      cible: 'https://app.deklic.pro',
    });
    expect(decisionBascule(base)).toEqual({
      type: 'rediriger',
      url: 'https://app.deklic.pro/projets/a?x=1#y',
    });
  });
});

describe('textes du transfert', () => {
  it('accorde les phrases au nombre', () => {
    const T = TEXTES_TRANSFERT;
    expect(T.bilan(0, 0)).toBe('Vos projets étaient déjà sur cet appareil : rien à ajouter.');
    expect(T.bilan(1, 0)).toBe('1 projet récupéré depuis l’ancienne adresse de Deklic.');
    expect(T.bilan(2, 1)).toBe('3 projets récupérés depuis l’ancienne adresse de Deklic.');
    expect(T.gardes(1)).toBe('1 projet était déjà plus récent sur cet appareil : il est gardé.');
    expect(T.gardes(2)).toBe(
      '2 projets étaient déjà plus récents sur cet appareil : ils sont gardés.',
    );
    expect(T.ignores(1)).toBe('1 projet n’a pas pu être lu et est laissé de côté.');
    expect(T.ignores(2)).toBe('2 projets n’ont pas pu être lus et sont laissés de côté.');
  });
});
