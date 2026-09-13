import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ecrireJson, ecrireTexte, lireJson, listerFichiers } from '../../src/commun/fichiers.ts';

let dossier: string;

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'loupe-data-'));
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

describe('ecrireTexte', () => {
  it('crée les dossiers intermédiaires', async () => {
    const chemin = join(dossier, 'dvf', '2025', '13055.csv');
    await ecrireTexte(chemin, 'date,prix\n');
    expect(await readFile(chemin, 'utf8')).toBe('date,prix\n');
  });
});

describe('ecrireJson et lireJson', () => {
  it('écrivent un JSON compact terminé par un saut de ligne et le relisent', async () => {
    const chemin = join(dossier, 'index.json');
    await ecrireJson(chemin, { a: 1, b: ['x'] });
    expect(await readFile(chemin, 'utf8')).toBe('{"a":1,"b":["x"]}\n');
    expect(await lireJson(chemin)).toEqual({ a: 1, b: ['x'] });
  });
});

describe('listerFichiers', () => {
  it("rend les fichiers portant l'extension, triés par nom", async () => {
    await ecrireTexte(join(dossier, 'b.json'), '{}');
    await ecrireTexte(join(dossier, 'a.json'), '{}');
    await ecrireTexte(join(dossier, 'c.txt'), '');
    expect(await listerFichiers(dossier, '.json')).toEqual([
      join(dossier, 'a.json'),
      join(dossier, 'b.json'),
    ]);
  });
});
