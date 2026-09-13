import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UsurePublieeSchema } from '../../../src/schemas/usure.ts';
import { DOSSIER_SAISIES_USURE } from '../../../src/sources/usure/constantes.ts';
import { executerUsure } from '../../../src/sources/usure/source.ts';
import { dossierTemporaire, fauxContexte } from '../../aides/faux-contexte.ts';

let dossier: string;

beforeEach(async () => {
  dossier = await dossierTemporaire();
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

describe('executerUsure', () => {
  it('publie les saisies du dépôt et désigne le troisième trimestre 2026 comme courant', async () => {
    const faux = fauxContexte(() => undefined, dossier);
    await executerUsure(faux.contexte, {});
    const courant = UsurePublieeSchema.parse(
      JSON.parse(await readFile(join(dossier, 'usure', 'courant.json'), 'utf8')),
    );
    expect(courant).toMatchObject({
      trimestre: '2026-T3',
      applicableDu: '2026-07-01',
      seuils: { fixe20AnsEtPlus: 0.0529, fixeMoins10Ans: 0.0407 },
      perime: false,
    });
    const t2 = UsurePublieeSchema.parse(
      JSON.parse(await readFile(join(dossier, 'usure', '2026-T2.json'), 'utf8')),
    );
    expect(t2).toMatchObject({
      trimestre: '2026-T2',
      seuils: { fixe20AnsEtPlus: 0.0519 },
      perime: true,
    });
    expect(faux.appels).toEqual([]);
    expect(faux.journal.at(-1)).toMatchObject({ message: 'usure : publié', courant: '2026-T3' });
    expect(DOSSIER_SAISIES_USURE).toMatch(/sources[\\/]usure[\\/]$/);
  });

  it('avertit quand le trimestre du jour manque et garde le précédent comme courant', async () => {
    const faux = fauxContexte(
      () => undefined,
      dossier,
      () => new Date('2026-10-15T08:00:00Z'),
    );
    await executerUsure(faux.contexte, {});
    expect(
      JSON.parse(await readFile(join(dossier, 'usure', 'courant.json'), 'utf8')),
    ).toMatchObject({
      trimestre: '2026-T3',
      perime: true,
    });
    expect(faux.journal).toContainEqual(
      expect.objectContaining({ niveau: 'avertissement', courant: '2026-T3', attendu: '2026-T4' }),
    );
  });

  it('échoue quand aucune saisie n’est encore applicable ou qu’une saisie est invalide', async () => {
    const saisies = join(dossier, 'saisies');
    const t3 = await readFile(join(DOSSIER_SAISIES_USURE, '2026-T3.json'), 'utf8');
    await writeFile(join(dossier, 'seule.json'), t3);
    const tropTot = fauxContexte(
      () => undefined,
      dossier,
      () => new Date('2026-05-01T08:00:00Z'),
    );
    await expect(executerUsure(tropTot.contexte, { dossierSaisies: dossier })).rejects.toThrow(
      'aucun trimestre applicable au 2026-05-01',
    );

    await rm(join(dossier, 'seule.json'));
    await writeFile(join(dossier, 'cassee.json'), '{"trimestre":"2026-Q3"}');
    const invalide = fauxContexte(() => undefined, dossier);
    await expect(executerUsure(invalide.contexte, { dossierSaisies: dossier })).rejects.toThrow();
    expect(saisies).toContain('saisies');
  });
});
