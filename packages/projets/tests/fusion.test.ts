import { describe, expect, it } from 'vitest';

import { MAX_CHANGEMENTS, type ReponseSynchro } from '../src/contrat';
import {
  appliquerReponse,
  changerDeCompte,
  detacherCompte,
  oublierCompte,
  preparerEnvoi,
  type EtatLocal,
} from '../src/fusion';
import { JOURNAL_VIDE } from '../src/journal';
import { DIX_HEURES, DIX_HEURES_UNE, enregistre, exemple, journal } from './exemples';

const RIEN_ENVOYE = { enregistres: {}, supprimes: {} };

function reponse(surcharges: Partial<ReponseSynchro> = {}): ReponseSynchro {
  return { curseur: 1, suite: false, ids: [], refuses: [], projets: [], ...surcharges };
}

describe('changerDeCompte', () => {
  it('même compte : rien ne change', () => {
    const etat: EtatLocal = { projets: [enregistre('p1')], journal: journal('u1') };
    expect(changerDeCompte(etat, 'u1')).toBe(etat);
  });

  it('premier compte : tous les projets sont à envoyer après une première lecture', () => {
    const etat: EtatLocal = { projets: [enregistre('p1'), exemple()], journal: JOURNAL_VIDE };
    expect(changerDeCompte(etat, 'camille')).toEqual({
      projets: etat.projets,
      journal: { ...journal('camille'), premiere: true, aEnvoyer: ['p1', 'exemple'] },
    });
  });

  it('autre compte : les projets synchronisés du précédent quittent l’appareil', () => {
    const etat: EtatLocal = {
      projets: [enregistre('lea-1'), enregistre('sans-compte')],
      journal: journal('lea', {
        synchronises: ['lea-1'],
        curseur: 9,
        aSupprimer: { x: DIX_HEURES },
      }),
    };
    const apres = changerDeCompte(etat, 'camille');
    expect(apres.projets.map((p) => p.id)).toEqual(['sans-compte']);
    expect(apres.journal).toEqual({
      ...journal('camille'),
      premiere: true,
      aEnvoyer: ['sans-compte'],
    });
  });
});

describe('oublierCompte et detacherCompte', () => {
  it('déconnexion : garde ce qui n’est pas encore sur le compte', () => {
    const etat: EtatLocal = {
      projets: [enregistre('synchro'), enregistre('modifie'), enregistre('jamais')],
      journal: journal('u1', { synchronises: ['synchro', 'modifie'], aEnvoyer: ['modifie'] }),
    };
    const apres = oublierCompte(etat);
    expect(apres.projets.map((p) => p.id)).toEqual(['modifie', 'jamais']);
    expect(apres.journal).toBe(JOURNAL_VIDE);
  });

  it('compte supprimé : tout reste, sans compte', () => {
    const etat: EtatLocal = { projets: [enregistre('p1')], journal: journal('u1') };
    expect(detacherCompte(etat)).toEqual({ projets: etat.projets, journal: JOURNAL_VIDE });
  });
});

describe('preparerEnvoi', () => {
  it('rien sans compte ni avant la première lecture', () => {
    const projets = [enregistre('p1')];
    for (const j of [JOURNAL_VIDE, journal('u1', { premiere: true, aEnvoyer: ['p1'] })]) {
      expect(preparerEnvoi({ projets, journal: j }).changements).toEqual([]);
    }
  });

  it('suppressions d’abord, projets absents ou exclus écartés, dates retenues', () => {
    const p1 = enregistre('p1', { modifieLe: DIX_HEURES_UNE });
    const etat: EtatLocal = {
      projets: [p1, enregistre('refuse')],
      journal: journal('u1', {
        aEnvoyer: ['absent', 'refuse', 'p1'],
        aSupprimer: { d1: DIX_HEURES },
      }),
    };
    const { changements, envoi } = preparerEnvoi(etat, new Set(['refuse']));
    expect(changements).toEqual([
      { type: 'supprimer', id: 'd1', le: DIX_HEURES },
      { type: 'enregistrer', projet: p1 },
    ]);
    expect(envoi).toEqual({ enregistres: { p1: DIX_HEURES_UNE }, supprimes: { d1: DIX_HEURES } });
  });

  it(`${String(MAX_CHANGEMENTS)} changements au plus, suppressions comprises`, () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${String(i)}`);
    const suppressions = Object.fromEntries(ids.map((id) => [`d-${id}`, DIX_HEURES]));
    const tropDeProjets: EtatLocal = {
      projets: ids.map((id) => enregistre(id)),
      journal: journal('u1', { aEnvoyer: ids }),
    };
    const tropDeSuppressions: EtatLocal = {
      projets: tropDeProjets.projets,
      journal: journal('u1', { aEnvoyer: ids, aSupprimer: suppressions }),
    };
    expect(preparerEnvoi(tropDeProjets).changements).toHaveLength(MAX_CHANGEMENTS);
    const lot = preparerEnvoi(tropDeSuppressions).changements;
    expect(lot).toHaveLength(MAX_CHANGEMENTS);
    expect(lot.every((c) => c.type === 'supprimer')).toBe(true);
  });
});

describe('appliquerReponse', () => {
  it('confirme les envois, ajoute les projets reçus, trie du plus récent au plus ancien', () => {
    const a = enregistre('a', { creeLe: '2026-09-01T00:00:00.000Z' });
    const c = enregistre('c', { creeLe: '2026-09-10T00:00:00.000Z' });
    const etat: EtatLocal = {
      projets: [a],
      journal: journal('u1', { aEnvoyer: ['a'], aSupprimer: { b: DIX_HEURES } }),
    };
    const envoi = { enregistres: { a: DIX_HEURES }, supprimes: { b: DIX_HEURES } };
    const apres = appliquerReponse(
      etat,
      envoi,
      reponse({ curseur: 7, ids: ['a', 'c'], projets: [c] }),
    );
    expect(apres.projets).toEqual([c, a]);
    expect(apres.journal).toEqual(
      journal('u1', { curseur: 7, synchronises: ['a', 'c'], aEnvoyer: [], aSupprimer: {} }),
    );
  });

  it('un projet modifié ou supprimé pendant l’envoi reste en attente, sa version locale gagne', () => {
    const modifie = enregistre('m', { nom: 'Local', modifieLe: DIX_HEURES_UNE });
    const etat: EtatLocal = {
      projets: [modifie],
      journal: journal('u1', { aEnvoyer: ['m'], aSupprimer: { s: DIX_HEURES_UNE } }),
    };
    const envoi = { enregistres: { m: DIX_HEURES }, supprimes: { s: DIX_HEURES } };
    const recus = [enregistre('m', { nom: 'Serveur' }), enregistre('s')];
    const apres = appliquerReponse(etat, envoi, reponse({ ids: ['m', 's'], projets: recus }));
    expect(apres.projets).toEqual([modifie]);
    expect(apres.journal.aEnvoyer).toEqual(['m']);
    expect(apres.journal.aSupprimer).toEqual({ s: DIX_HEURES_UNE });
  });

  it('un envoi perdu contre une version plus récente du compte prend la version du compte', () => {
    const etat: EtatLocal = {
      projets: [enregistre('p')],
      journal: journal('u1', { aEnvoyer: ['p'] }),
    };
    const recent = enregistre('p', { nom: 'Plus récent', modifieLe: DIX_HEURES_UNE });
    const apres = appliquerReponse(
      etat,
      { enregistres: { p: DIX_HEURES }, supprimes: {} },
      reponse({ ids: ['p'], projets: [recent] }),
    );
    expect(apres.projets).toEqual([recent]);
    expect(apres.journal.aEnvoyer).toEqual([]);
  });

  it('un projet refusé (limite) reste sur l’appareil et en attente', () => {
    const etat: EtatLocal = {
      projets: [enregistre('r')],
      journal: journal('u1', { aEnvoyer: ['r'] }),
    };
    const apres = appliquerReponse(
      etat,
      { enregistres: { r: DIX_HEURES }, supprimes: {} },
      reponse({ refuses: ['r'] }),
    );
    expect(apres.projets.map((p) => p.id)).toEqual(['r']);
    expect(apres.journal.aEnvoyer).toEqual(['r']);
  });

  it('un projet synchronisé absent du compte quitte l’appareil ; un id en attente sans projet sort du journal', () => {
    const etat: EtatLocal = {
      projets: [enregistre('supprime-ailleurs'), enregistre('garde')],
      journal: journal('u1', {
        aEnvoyer: ['disparu'],
        synchronises: ['supprime-ailleurs', 'garde'],
      }),
    };
    const apres = appliquerReponse(etat, RIEN_ENVOYE, reponse({ ids: ['garde'] }));
    expect(apres.projets.map((p) => p.id)).toEqual(['garde']);
    expect(apres.journal.aEnvoyer).toEqual([]);
  });

  it('première lecture d’un compte qui a des projets : l’exemple intact quitte l’appareil', () => {
    const etat: EtatLocal = {
      projets: [exemple(), enregistre('local')],
      journal: journal('u1', { premiere: true, aEnvoyer: ['exemple', 'local'] }),
    };
    const distant = enregistre('distant', { creeLe: '2026-08-01T00:00:00.000Z' });
    const apres = appliquerReponse(
      etat,
      RIEN_ENVOYE,
      reponse({ ids: ['distant'], projets: [distant] }),
    );
    expect(apres.projets.map((p) => p.id)).toEqual(['local', 'distant']);
    expect(apres.journal.aEnvoyer).toEqual(['local']);
    expect(apres.journal.premiere).toBe(false);
  });

  it('première lecture d’un compte vide : l’exemple reste et sera envoyé', () => {
    const etat: EtatLocal = {
      projets: [exemple()],
      journal: journal('u1', { premiere: true, aEnvoyer: ['exemple'] }),
    };
    const apres = appliquerReponse(etat, RIEN_ENVOYE, reponse({ curseur: 0 }));
    expect(apres.projets.map((p) => p.id)).toEqual(['exemple']);
    expect(apres.journal.aEnvoyer).toEqual(['exemple']);
  });

  it('deux projets créés au même instant gardent leur ordre', () => {
    const etat: EtatLocal = {
      projets: [enregistre('x'), enregistre('y')],
      journal: journal('u1', { synchronises: ['x', 'y'] }),
    };
    const apres = appliquerReponse(etat, RIEN_ENVOYE, reponse({ ids: ['x', 'y'] }));
    expect(apres.projets.map((p) => p.id)).toEqual(['x', 'y']);
  });
});
