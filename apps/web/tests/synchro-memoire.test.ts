import { projetExemple, ProjetSchema } from '@loupe/moteur';
import type { Changement, ProjetEnregistre, ReponseSynchro } from '@loupe/projets';
import { describe, expect, it } from 'vitest';

import { clientProjetsMemoire } from '@/stockage/synchro/memoire';

const DIX = '2026-09-14T10:00:00.000Z';
const DIX_CINQ = '2026-09-14T10:05:00.000Z';
const MIDI = (): string => '2026-09-14T12:00:00.000Z';

function projet(id: string, modifieLe = DIX, nom = `Projet ${id}`): ProjetEnregistre {
  return {
    id,
    nom,
    statut: 'analyse',
    creeLe: DIX,
    modifieLe,
    projet: ProjetSchema.parse({ ...projetExemple, id }),
  };
}

const enregistrer = (p: ProjetEnregistre): Changement => ({ type: 'enregistrer', projet: p });

async function valeur(
  promesse: ReturnType<ReturnType<typeof clientProjetsMemoire>['synchroniser']>,
): Promise<ReponseSynchro> {
  const r = await promesse;
  if (!r.ok) throw new Error(r.code);
  return r.valeur;
}

describe('clientProjetsMemoire', () => {
  it('rend les projets du compte, n’en renvoie pas à l’appareil qui vient de les écrire', async () => {
    const client = clientProjetsMemoire({ projets: [projet('a')], maintenant: MIDI });
    expect(await valeur(client.synchroniser({ depuis: 0, changements: [] }))).toEqual({
      curseur: 1,
      suite: false,
      ids: ['a'],
      refuses: [],
      projets: [projet('a')],
    });
    const envoi = await valeur(
      client.synchroniser({ depuis: 1, changements: [enregistrer(projet('b'))] }),
    );
    expect(envoi).toEqual({ curseur: 2, suite: false, ids: ['a', 'b'], refuses: [], projets: [] });
    expect(client.distants().map((p) => p.id)).toEqual(['a', 'b']);
    expect(client.demandes).toHaveLength(2);
  });

  it('dernière modification gagne, date bornée, suppression perdue sans effet', async () => {
    const client = clientProjetsMemoire({
      projets: [projet('a', DIX_CINQ, 'Récent')],
      maintenant: MIDI,
    });
    const perdu = await valeur(
      client.synchroniser({ depuis: 1, changements: [enregistrer(projet('a', DIX, 'Ancien'))] }),
    );
    expect(perdu.projets).toEqual([projet('a', DIX_CINQ, 'Récent')]);

    await client.synchroniser({
      depuis: 1,
      changements: [{ type: 'supprimer', id: 'a', le: DIX }],
    });
    expect(client.distants()).toHaveLength(1);

    await client.synchroniser({
      depuis: 1,
      changements: [{ type: 'supprimer', id: 'a', le: '2027-01-01T00:00:00.000Z' }],
    });
    expect(client.distants()).toEqual([]);
    // Supprimé à midi (date bornée) : une version de 11 h ne le ressuscite pas.
    const tardif = await valeur(
      client.synchroniser({
        depuis: 2,
        changements: [enregistrer(projet('a', '2026-09-14T11:00:00.000Z'))],
      }),
    );
    expect(tardif).toMatchObject({ ids: [], projets: [] });
  });

  it('limite, pages et curseur inconnu', async () => {
    const client = clientProjetsMemoire({ limite: 3, page: 2 });
    const plein = await valeur(
      client.synchroniser({
        depuis: 0,
        changements: ['a', 'b', 'c', 'd'].map((id) => enregistrer(projet(id))),
      }),
    );
    expect(plein.refuses).toEqual(['d']);
    const page1 = await valeur(client.synchroniser({ depuis: 0, changements: [] }));
    expect(page1).toMatchObject({ suite: true, curseur: 2 });
    expect(page1.projets.map((p) => p.id)).toEqual(['a', 'b']);
    const page2 = await valeur(client.synchroniser({ depuis: 2, changements: [] }));
    expect(page2).toMatchObject({ suite: false, curseur: 3 });
    expect((await valeur(client.synchroniser({ depuis: 99, changements: [] }))).curseur).toBe(2);
  });

  it('échoue à la demande, puis reprend', async () => {
    const client = clientProjetsMemoire();
    client.echouer('reseau');
    expect(await client.synchroniser({ depuis: 0, changements: [] })).toEqual({
      ok: false,
      code: 'reseau',
    });
    client.echouer(null);
    expect((await client.synchroniser({ depuis: 0, changements: [] })).ok).toBe(true);
  });
});
