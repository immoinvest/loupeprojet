import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Arguments } from '../../src/cli/arguments.ts';
import { NOMS_SOURCES } from '../../src/cli/arguments.ts';
import { EXECUTEURS, executerSources, type Executeur } from '../../src/sources/executer.ts';
import { dossierTemporaire, fauxContexte } from '../aides/faux-contexte.ts';

let dossier: string;

beforeEach(async () => {
  dossier = await dossierTemporaire();
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

const ARGS: Arguments = {
  aide: false,
  sources: ['usure', 'zonage'],
  departements: ['2A'],
  passeComplete: false,
  dossierSortie: 'dist',
};

describe('executerSources', () => {
  it('exécute les sources demandées dans l’ordre et journalise début, fin et durée', async () => {
    const appels: string[] = [];
    let tic = 0;
    const faux = fauxContexte(
      () => undefined,
      dossier,
      () => new Date(Date.UTC(2026, 8, 13, 10, 0, (tic += 5))),
    );
    const executeurs: Record<string, Executeur> = {};
    for (const nom of NOMS_SOURCES) {
      executeurs[nom] = (contexte, args) => {
        appels.push(`${nom}:${args.departements.join(',')}:${contexte.dossierSortie}`);
        return Promise.resolve();
      };
    }
    await executerSources(faux.contexte, ARGS, executeurs as typeof EXECUTEURS);
    expect(appels).toEqual([`usure:2A:${dossier}`, `zonage:2A:${dossier}`]);
    expect(faux.journal.map((entree) => [entree.message, entree.source])).toEqual([
      ['source : début', 'usure'],
      ['source : terminée', 'usure'],
      ['source : début', 'zonage'],
      ['source : terminée', 'zonage'],
    ]);
    // L'horloge avance de 5 s à chaque lecture, y compris pour l'horodatage des lignes de journal :
    // début (5) → journal (10) → fin mesurée (15), soit 10 s.
    expect(faux.journal[1]).toMatchObject({ dureeSecondes: 10 });
  });
});

describe('EXECUTEURS', () => {
  it('connaît chaque source de la ligne de commande', () => {
    expect(Object.keys(EXECUTEURS).sort()).toEqual([...NOMS_SOURCES].sort());
  });

  it('publie les seuils de l’usure sans réseau', async () => {
    const faux = fauxContexte(() => undefined, dossier);
    await EXECUTEURS.usure(faux.contexte, ARGS);
    expect(
      JSON.parse(await readFile(join(dossier, 'usure', 'courant.json'), 'utf8')),
    ).toMatchObject({
      trimestre: '2026-T3',
    });
  });

  it('transmet départements, millésime et exercice aux sources distantes, qui échouent sans réseau', async () => {
    const faux = fauxContexte(() => undefined, dossier);
    const args: Arguments = { ...ARGS, millesimeDvf: 2025, anneeRei: '2025' };
    // DVF tolère les dossiers annuels absents : millésime imposé → aucune vente, pas d'erreur ;
    // sans millésime, le sondage échoue.
    await expect(EXECUTEURS.dvf(faux.contexte, args)).resolves.toBeUndefined();
    await expect(EXECUTEURS.dvf(faux.contexte, ARGS)).rejects.toThrow();
    for (const nom of ['loyers', 'taxe-fonciere', 'zonage', 'communes'] as const) {
      await expect(EXECUTEURS[nom](faux.contexte, args)).rejects.toThrow();
      await expect(EXECUTEURS[nom](faux.contexte, ARGS)).rejects.toThrow();
    }
    expect(faux.journal).toContainEqual(
      expect.objectContaining({ message: 'aucune vente de logement retenue', departement: '2A' }),
    );
    expect(faux.appels.map((appel) => appel.url)).toContain(
      'https://files.data.gouv.fr/geo-dvf/latest/csv/2025/departements/2A.csv.gz',
    );
    expect(faux.appels.some((appel) => appel.url.includes('annee%3D%222025%22'))).toBe(true);
  });
});
