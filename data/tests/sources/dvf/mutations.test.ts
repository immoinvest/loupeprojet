import { describe, expect, it } from 'vitest';
import { lireCsv } from '../../../src/commun/csv.ts';
import { collecter, depuisMorceaux } from '../../../src/commun/flux.ts';
import { regrouperParMutation } from '../../../src/sources/dvf/mutations.ts';
import { lireFixture } from '../../aides/faux-contexte.ts';

describe('regrouperParMutation', () => {
  it('regroupe les lignes contiguës et signale un identifiant qui réapparaît plus bas', async () => {
    const texte = (await lireFixture('dvf/2A-2025.csv')).toString('utf8');
    const groupes = await collecter(
      regrouperParMutation(lireCsv(depuisMorceaux([texte]), { separateur: ',' })),
    );
    expect(groupes).toHaveLength(18);
    expect(groupes.map((groupe) => groupe.lignes.length).slice(0, 8)).toEqual([
      1, 1, 2, 1, 2, 1, 4, 2,
    ]);
    expect(groupes.filter((groupe) => groupe.rupture).map((groupe) => groupe.id)).toEqual([
      '2025-327563',
    ]);
    expect(groupes[2]?.id).toBe('2025-327560');
  });

  it('ne rend rien sans ligne et accepte une colonne id_mutation absente', async () => {
    expect(await collecter(regrouperParMutation(depuisMorceaux([])))).toEqual([]);
    const sansId = await collecter(regrouperParMutation(depuisMorceaux([{ a: '1' }, { a: '2' }])));
    expect(sansId).toEqual([{ id: '', lignes: [{ a: '1' }, { a: '2' }], rupture: false }]);
  });
});
