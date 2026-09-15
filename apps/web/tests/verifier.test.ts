import { VERSION_REGLES_COURANTE, obtenirRegles } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { apportParDefaut, apportPourPart } from '@/annonces/apport';
import { valeursDepuisChamps, type Cle, type Valeurs } from '@/ecrans/formulaire/valeurs';
import { TOUS_LES_GROUPES } from '@/hypotheses';
import { GLOSSAIRE, type CodeTerme } from '@/textes/glossaire';
import { avecChambresEstimees, choixApport } from '@/verifier/deductions';
import {
  estMasque,
  estRenseigne,
  groupeDeItem,
  grouperChamps,
  itemsVisibles,
  provenanceEnvoyee,
  resumeEstimes,
  resumeLus,
  resumePreciser,
  sansValeursMasquees,
} from '@/verifier/groupes';
import { ITEMS, ORDRE_ITEMS, TERMES_VERIFIER, itemDeCle } from '@/verifier/items';
import { DEBUT_CONVENTIONNEL, periodeDeAnnee, periodesConstruction } from '@/verifier/periodes';

const VIDE = valeursDepuisChamps({});
const avec = (champs: Partial<Valeurs>): Valeurs => ({ ...VIDE.valeurs, ...champs });

describe('items', () => {
  it('chaque clé de Valeurs appartient à un seul item', () => {
    const cles = Object.keys(VIDE.valeurs) as Cle[];
    const vues = ORDRE_ITEMS.flatMap((item) => ITEMS[item].cles);
    expect([...vues].sort()).toEqual([...cles].sort());
    expect(itemDeCle('ville')).toBe('commune');
    expect(itemDeCle('codePostal')).toBe('commune');
    expect(itemDeCle('nuitee')).toBe('loyer');
    expect(itemDeCle('dpe')).toBe('dpe');
  });

  it('chaque terme du glossaire sert dans Vérifier ou dans Hypothèses', () => {
    const utilises = new Set<CodeTerme>([
      ...TERMES_VERIFIER,
      ...TOUS_LES_GROUPES.flatMap((g) => g.champs.flatMap((d) => d.terme ?? [])),
    ]);
    expect([...utilises].sort()).toEqual(Object.keys(GLOSSAIRE).sort());
    expect(new Set(TERMES_VERIFIER).size).toBe(TERMES_VERIFIER.length);
  });
});

describe('périodes de construction', () => {
  const regles = obtenirRegles(VERSION_REGLES_COURANTE);
  const periodes = periodesConstruction(regles);

  it('bornes lues dans les règles de visite', () => {
    const reference = Number(regles.dateReference.slice(0, 4));
    const recente = reference - regles.visite.installationsAnciennesAns + 1;
    expect(periodes.map((p) => p.libelle)).toEqual([
      `Avant ${String(regles.visite.plombAvantAnnee)}`,
      `${String(regles.visite.plombAvantAnnee)} à ${String(regles.visite.amianteAvantAnnee - 1)}`,
      `${String(regles.visite.amianteAvantAnnee)} à ${String(recente - 1)}`,
      `${String(recente)} et après`,
    ]);
  });

  it('chaque année représentative tombe dans sa période', () => {
    for (const p of periodes) {
      expect(p.representative).toBeGreaterThanOrEqual(p.debut ?? DEBUT_CONVENTIONNEL);
      if (p.fin !== null) expect(p.representative).toBeLessThanOrEqual(p.fin);
      expect(periodeDeAnnee(String(p.representative), periodes)).toBe(p.code);
    }
  });

  it.each([
    ['1890', 'avant_plomb'],
    ['1948', 'avant_plomb'],
    ['1949', 'avant_amiante'],
    ['1996', 'avant_amiante'],
    ['1997', 'installations_anciennes'],
    ['2011', 'installations_anciennes'],
    ['2012', 'recente'],
    ['2031', 'recente'],
    ['', ''],
    ['19a0', ''],
    ['197', ''],
  ])('%j → %j', (annee, code) => {
    expect(periodeDeAnnee(annee, periodes)).toBe(code);
  });

  it('sans périodes : rien', () => {
    expect(periodeDeAnnee('1970', [])).toBe('');
  });
});

describe('grouperChamps', () => {
  it('saisie à la main : l’essentiel, les défauts estimés, le reste à préciser (DPE et état en tête)', () => {
    const g = grouperChamps(VIDE.valeurs, VIDE.provenance);
    expect(g.essentiel).toEqual(['prix', 'surface', 'commune', 'mode', 'loyer']);
    expect(g.lus).toEqual([]);
    expect(g.estimes).toEqual(['apport', 'dureeAnnees', 'tmi']);
    expect(g.preciser.slice(0, 5)).toEqual([
      'dpe',
      'etat',
      'chargesCoproMois',
      'taxeFonciere',
      'typeBien',
    ]);
    expect(groupeDeItem(g, 'dpe')).toBe('preciser');
    expect(groupeDeItem(g, 'loyer')).toBe('essentiel');
  });

  it('annonce lue : seuls le loyer et ce qui manque restent en haut', () => {
    const lue = valeursDepuisChamps({
      prix: 155_000,
      surface: 65,
      codePostal: '13005',
      ville: 'Marseille',
      dpe: 'D',
      mode: 'nu',
    });
    const g = grouperChamps(lue.valeurs, lue.provenance);
    expect(g.essentiel).toEqual(['loyer']);
    expect(g.lus).toEqual(['prix', 'surface', 'commune', 'dpe', 'mode']);
    expect(g.preciser).not.toContain('dpe');
  });

  it('commune incomplète : en haut ; valeur sans provenance rangée à la fin de « préciser »', () => {
    const partielle = valeursDepuisChamps({ codePostal: '13005', prix: 90_000 });
    expect(grouperChamps(partielle.valeurs, partielle.provenance).essentiel).toContain('commune');
    const g = grouperChamps(
      avec({ prix: '100', surface: '20', codePostal: '69003', ville: 'Lyon' }),
      {},
    );
    // Sans aucune provenance, apport, durée et tranche ne sont pas « estimés » : eux aussi à la fin.
    expect(g.preciser.slice(-6)).toEqual([
      'prix',
      'surface',
      'commune',
      'apport',
      'dureeAnnees',
      'tmi',
    ]);
    expect(g.estimes).toEqual([]);
  });

  it('groupeDeItem refuse un item rangé nulle part', () => {
    expect(() =>
      groupeDeItem({ essentiel: [], lus: [], estimes: [], preciser: [] }, 'dpe'),
    ).toThrow(/aucun groupe/);
  });
});

describe('estRenseigne', () => {
  it('commune : code postal à cinq chiffres et ville', () => {
    expect(estRenseigne('commune', avec({ codePostal: '69003', ville: 'Lyon' }))).toBe(true);
    expect(estRenseigne('commune', avec({ codePostal: '6900', ville: 'Lyon' }))).toBe(false);
    expect(estRenseigne('commune', avec({ codePostal: '69003', ville: ' ' }))).toBe(false);
    expect(estRenseigne('prix', avec({ prix: '1' }))).toBe(true);
    expect(estRenseigne('prix', VIDE.valeurs)).toBe(false);
  });
});

describe('masquage', () => {
  it('maison : ni étage, ni ascenseur, ni copropriété ; rez-de-chaussée : pas d’ascenseur', () => {
    const maison = avec({ typeBien: 'maison', etage: '2' });
    expect(estMasque('etage', maison)).toBe(true);
    expect(estMasque('lotsCopro', maison)).toBe(true);
    expect(estMasque('dpe', maison)).toBe(false);
    expect(estMasque('ascenseur', avec({ etage: '0' }))).toBe(true);
    expect(estMasque('ascenseur', avec({ etage: '3' }))).toBe(false);
    expect(itemsVisibles(['etage', 'dpe', 'ascenseur'], maison)).toEqual(['dpe']);
  });

  it('les valeurs masquées ne partent pas', () => {
    const maison = sansValeursMasquees(
      avec({
        typeBien: 'maison',
        etage: '2',
        ascenseur: 'oui',
        chargesCoproMois: '80',
        lotsCopro: '12',
        coproEnProcedure: 'non',
        dpe: 'C',
      }),
    );
    expect(maison).toMatchObject({
      etage: '',
      ascenseur: '',
      chargesCoproMois: '',
      lotsCopro: '',
      coproEnProcedure: '',
      dpe: 'C',
    });
    expect(
      sansValeursMasquees(avec({ etage: '0', ascenseur: 'non', lotsCopro: '5' })),
    ).toMatchObject({
      etage: '0',
      ascenseur: '',
      lotsCopro: '5',
    });
  });
});

describe('provenanceEnvoyee', () => {
  it('oublie la provenance d’un champ vidé parce que masqué, garde celle d’un champ déjà vide', () => {
    const avant = avec({ typeBien: 'maison', etage: '2', dpe: 'C', apport: '' });
    const envoyees = sansValeursMasquees(avant);
    expect(
      provenanceEnvoyee(avant, envoyees, { etage: 'annonce', dpe: 'annonce', apport: 'estime' }),
    ).toEqual({ dpe: 'annonce', apport: 'estime' });
  });
});

describe('résumés', () => {
  it('lus, estimés, à préciser', () => {
    expect(resumeLus(['prix'])).toBe('1 information');
    expect(resumeLus(['prix', 'surface'])).toBe('2 informations');
    const v = avec({ chambres: '2' });
    expect(resumeEstimes(['apport', 'dureeAnnees', 'tmi', 'chambres', 'annee'], v, 0.1)).toMatch(
      /^apport 10\s%, 25 ans, tranche 30\s%, 2 chambres, année$/,
    );
    expect(resumeEstimes(['apport', 'chambres'], avec({ chambres: '1' }), null)).toBe(
      'apport, 1 chambre',
    );
    expect(resumeEstimes(['chambres'], avec({ chambres: '0' }), null)).toBe('0 chambre');
    expect(resumePreciser(['dpe', 'etat', 'chargesCoproMois', 'taxeFonciere', 'typeBien'])).toBe(
      'DPE, état, charges de copro, taxe foncière…',
    );
    expect(resumePreciser(['dpe', 'ges'])).toBe('DPE, GES');
  });
});

describe('déductions', () => {
  it('chambres = pièces − 1, estimées, jamais à la place de l’annonce ou de la personne', () => {
    expect(avecChambresEstimees(avec({ pieces: '3' }), {})).toEqual({
      valeurs: avec({ pieces: '3', chambres: '2' }),
      provenance: { chambres: 'estime' },
    });
    expect(avecChambresEstimees(avec({ pieces: '1' }), {}).valeurs.chambres).toBe('0');
    const annonce = {
      valeurs: avec({ pieces: '4', chambres: '1' }),
      provenance: { chambres: 'annonce' as const },
    };
    expect(avecChambresEstimees(annonce.valeurs, annonce.provenance)).toEqual(annonce);
    expect(
      avecChambresEstimees(avec({ pieces: '5' }), { chambres: 'utilisateur' }).valeurs.chambres,
    ).toBe('');
    expect(
      avecChambresEstimees(avec({ pieces: '', chambres: '2' }), {
        chambres: 'estime',
        prix: 'annonce',
      }),
    ).toEqual({
      valeurs: avec({ pieces: '', chambres: '' }),
      provenance: { prix: 'annonce' },
    });
  });

  it('la tuile de l’apport', () => {
    expect(choixApport('12000', true, 100_000)).toBe('0.1');
    expect(choixApport(' ', false, 100_000)).toBe('0.1');
    expect(choixApport('0', false, null)).toBe('0');
    expect(choixApport('10 000', false, 100_000)).toBe('0.1');
    expect(choixApport('20000', false, 100_000)).toBe('0.2');
    expect(choixApport('15000', false, 100_000)).toBe('autre');
    expect(choixApport('20000', false, null)).toBe('autre');
  });

  it('apport pour une part du coût total, arrondi à la centaine', () => {
    expect(apportPourPart(123_456, 0.2)).toBe(24_700);
    expect(apportParDefaut(123_456)).toBe(12_300);
  });
});
