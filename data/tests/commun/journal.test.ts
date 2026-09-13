import { afterEach, describe, expect, it, vi } from 'vitest';
import { creerJournal, journalStandard } from '../../src/commun/journal.ts';

const HORLOGE = (): Date => new Date('2026-09-13T10:00:00.000Z');

describe('creerJournal', () => {
  it('écrit une ligne JSON par événement, avec les détails', () => {
    const lignes: string[] = [];
    const journal = creerJournal({
      ecrire: (ligne) => lignes.push(ligne),
      horloge: HORLOGE,
      annotationsGitHub: false,
    });
    journal.info('départ', { departement: '13' });
    journal.avertissement('attention');
    journal.erreur('échec', { code: 500 });
    expect(lignes.map((ligne) => JSON.parse(ligne) as unknown)).toEqual([
      {
        horodatage: '2026-09-13T10:00:00.000Z',
        niveau: 'info',
        message: 'départ',
        departement: '13',
      },
      { horodatage: '2026-09-13T10:00:00.000Z', niveau: 'avertissement', message: 'attention' },
      { horodatage: '2026-09-13T10:00:00.000Z', niveau: 'erreur', message: 'échec', code: 500 },
    ]);
  });

  it("double les avertissements et erreurs d'une annotation GitHub quand demandé", () => {
    const lignes: string[] = [];
    const journal = creerJournal({
      ecrire: (ligne) => lignes.push(ligne),
      horloge: HORLOGE,
      annotationsGitHub: true,
    });
    journal.info('rien de spécial');
    journal.avertissement('trimestre manquant');
    journal.erreur('téléchargement impossible');
    expect(lignes.filter((ligne) => ligne.startsWith('::'))).toEqual([
      '::warning::trimestre manquant',
      '::error::téléchargement impossible',
    ]);
  });
});

describe('journalStandard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("écrit sur la sortie d'erreur, avec annotations dans une Action GitHub", () => {
    const ecriture = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    journalStandard({ GITHUB_ACTIONS: 'true' }).avertissement('vérifier');
    expect(ecriture).toHaveBeenCalledTimes(2);
    expect(ecriture.mock.calls[1]?.[0]).toBe('::warning::vérifier\n');
    expect(String(ecriture.mock.calls[0]?.[0])).toContain('"niveau":"avertissement"');
  });

  it('se passe des annotations hors GitHub', () => {
    const ecriture = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    journalStandard({}).erreur('sans annotation');
    expect(ecriture).toHaveBeenCalledTimes(1);
  });
});
