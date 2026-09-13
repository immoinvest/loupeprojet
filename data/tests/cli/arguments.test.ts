import { describe, expect, it } from 'vitest';
import { AIDE, ErreurArguments, NOMS_SOURCES, analyserArguments } from '../../src/cli/arguments.ts';
import { DEPARTEMENTS } from '../../src/commun/departements.ts';

describe('analyserArguments', () => {
  it('lit une source et des départements, sans passe complète', () => {
    const args = analyserArguments([
      '--source',
      'dvf',
      '--departement',
      '13',
      '--departement',
      '2a',
    ]);
    expect(args).toEqual({
      aide: false,
      sources: ['dvf'],
      departements: ['13', '2A'],
      passeComplete: false,
      dossierSortie: 'dist',
    });
  });

  it('couvre tous les départements et toutes les sources avec « tout », sans doublon', () => {
    const args = analyserArguments(['--source', 'tout', '--source', 'dvf', '--sortie', '/tmp/ref']);
    expect(args.sources).toEqual([...NOMS_SOURCES]);
    expect(args.departements).toEqual([...DEPARTEMENTS]);
    expect(args.passeComplete).toBe(true);
    expect(args.dossierSortie).toBe('/tmp/ref');
    expect(
      analyserArguments([
        '--source',
        'usure',
        '--source',
        'usure',
        '--departement',
        '13',
        '--departement',
        '13',
      ]),
    ).toMatchObject({
      sources: ['usure'],
      departements: ['13'],
    });
  });

  it('accepte le millésime DVF et l’exercice REI imposés', () => {
    expect(
      analyserArguments(['--source', 'dvf', '--millesime-dvf', '2025', '--annee-rei', '2024']),
    ).toMatchObject({ millesimeDvf: 2025, anneeRei: '2024' });
  });

  it('rend l’aide sans exiger de source', () => {
    expect(analyserArguments(['--aide'])).toMatchObject({ aide: true, sources: [] });
    expect(AIDE).toContain('--source <nom>');
  });

  it('refuse les usages incorrects avec un message clair', () => {
    expect(() => analyserArguments([])).toThrow(new ErreurArguments('--source est obligatoire'));
    expect(() => analyserArguments(['--source', 'cadastre'])).toThrow('source inconnue : cadastre');
    expect(() => analyserArguments(['--source', 'dvf', '--departement', '20'])).toThrow(
      'département inconnu : 20',
    );
    expect(() => analyserArguments(['--source', 'dvf', '--millesime-dvf', '25'])).toThrow(
      '--millesime-dvf attend une année sur quatre chiffres : 25',
    );
    expect(() => analyserArguments(['--inconnue'])).toThrow(ErreurArguments);
  });
});
