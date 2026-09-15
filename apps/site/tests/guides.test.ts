import { describe, expect, it } from 'vitest';

import { LISTE_CATEGORIES } from '../src/lib/guides/categories';
import { cheminsGuides } from '../src/lib/guides/chemins';
import {
  contientMotCle,
  motsClesEnDouble,
  placementMotCle,
  publies,
  verifierMotsCles,
  type EntreeGuide,
} from '../src/lib/guides/controles';
import { nombreDeMots, tempsDeLecture } from '../src/lib/guides/lecture';
import { guidesLies } from '../src/lib/guides/lies';
import { sommaire } from '../src/lib/guides/sommaire';
import { guide } from './aides-guides';

describe('publies', () => {
  it('écarte les brouillons et trie par mise à jour puis par titre', () => {
    const a = guide('a', { misAJourLe: new Date('2026-09-10') });
    const b = guide('b', { misAJourLe: new Date('2026-09-12') });
    const c = guide('c', { misAJourLe: new Date('2026-09-10'), titre: 'Autre titre' });
    const brouillon = guide('d', { brouillon: true, misAJourLe: new Date('2026-09-30') });
    expect(publies([a, b, c, brouillon]).map((g) => g.id)).toEqual(['b', 'c', 'a']);
  });
});

/** Un guide dont le mot-clé est bien placé partout. */
function guidePlace(id: string, motCle: string): EntreeGuide {
  return {
    ...guide(id, { motCle, titre: motCle, titreSeo: motCle }),
    body: `Tout sur ${motCle}.`,
  };
}

describe('mots-clés principaux', () => {
  it('repère le même mot-clé malgré accents, majuscules et espaces', () => {
    const guides = [
      guidePlace('rentabilite-locative-calcul', 'Rentabilité  locative calcul'),
      guidePlace('calcul-rentabilite-locative', 'rentabilite locative calcul'),
      guidePlace('lmnp-ou-location-nue', 'lmnp ou location nue'),
    ];
    expect(motsClesEnDouble(guides)).toEqual([
      '« rentabilite locative calcul » visé par : rentabilite-locative-calcul, calcul-rentabilite-locative',
    ]);
    expect(() => {
      verifierMotsCles(guides);
    }).toThrow(/Mots-clés des guides/);
  });

  it('laisse passer des mots-clés distincts et bien placés', () => {
    expect(() => {
      verifierMotsCles([
        guidePlace('quittance-loyer', 'quittance de loyer'),
        guidePlace('lmnp', 'lmnp'),
      ]);
    }).not.toThrow();
  });

  it('ignore accents, casse, ponctuation et petits mots', () => {
    expect(contientMotCle('Quittance de loyer : modèle gratuit', 'quittance loyer modele')).toBe(
      true,
    );
    expect(contientMotCle('Calcul de la rentabilité locative', 'calcul rentabilité locative')).toBe(
      true,
    );
    expect(contientMotCle('Rentabilité locative', 'calcul rentabilité locative')).toBe(false);
  });

  it('dit où le mot-clé manque : title, titre, adresse, début du texte', () => {
    const mal: EntreeGuide = {
      ...guide('autre-sujet', {
        motCle: 'cash-flow immobilier',
        titre: 'Le cash-flow expliqué',
        titreSeo: 'Cash-flow immobilier : définition et calcul',
      }),
      body: `${'mot '.repeat(100)} cash-flow immobilier`,
    };
    expect(placementMotCle(mal)).toEqual([
      'autre-sujet : « cash-flow immobilier » absent de le titre',
      'autre-sujet : « cash-flow immobilier » absent de l’adresse',
      'autre-sujet : « cash-flow immobilier » absent de les 100 premiers mots',
    ]);
    expect(placementMotCle({ ...mal, body: undefined })).toContain(
      'autre-sujet : « cash-flow immobilier » absent de les 100 premiers mots',
    );
  });
});

describe('cheminsGuides', () => {
  it('place catégories et guides sous /guides/', () => {
    const pages = cheminsGuides(LISTE_CATEGORIES, [guide('lmnp-ou-location-nue')]);
    expect(pages.map((p) => `${p.type}:${p.slug}`)).toEqual([
      'categorie:investir',
      'categorie:trouver-un-bien',
      'categorie:fiscalite',
      'categorie:gerer-ses-locataires',
      'article:lmnp-ou-location-nue',
    ]);
  });

  it('refuse un guide qui prend l’adresse d’une catégorie', () => {
    expect(() => cheminsGuides(LISTE_CATEGORIES, [guide('fiscalite')])).toThrow(
      '/guides/fiscalite/ prise deux fois',
    );
  });

  it.each(['Majuscules', 'avec espace', 'fin-', 'accentué'])('refuse le slug « %s »', (slug) => {
    expect(() => cheminsGuides([], [guide(slug)])).toThrow(/Adresse de guide invalide/);
  });
});

describe('guidesLies', () => {
  it('propose la même catégorie d’abord, sans le guide courant ni les brouillons', () => {
    const courant = guide('courant', { categorie: 'fiscalite' });
    const tous = [
      courant,
      guide('investir-recent', { misAJourLe: new Date('2026-09-14') }),
      guide('fiscal-ancien', { categorie: 'fiscalite', misAJourLe: new Date('2026-08-01') }),
      guide('fiscal-brouillon', { categorie: 'fiscalite', brouillon: true }),
      guide('gerer', { categorie: 'gerer-ses-locataires', misAJourLe: new Date('2026-09-02') }),
      guide('trouver', { categorie: 'trouver-un-bien', misAJourLe: new Date('2026-07-01') }),
    ];
    expect(guidesLies(courant, tous).map((g) => g.id)).toEqual([
      'fiscal-ancien',
      'investir-recent',
      'gerer',
    ]);
    expect(guidesLies(courant, tous, 1).map((g) => g.id)).toEqual(['fiscal-ancien']);
  });
});

describe('lecture', () => {
  it('compte les mots sans les imports ni les balises des composants', () => {
    const corps = [
      "import Regle from '../../src/composants/Regle.astro';",
      '',
      'L\'investissement locatif rapporte-t-il ? <Regle chemin="x" format="taux" /> en 2026.',
    ].join('\n');
    expect(nombreDeMots(corps)).toBe(5);
    expect(nombreDeMots('')).toBe(0);
  });

  it('arrondit le temps de lecture à la minute supérieure, une minute au moins', () => {
    expect(tempsDeLecture('')).toBe(1);
    expect(tempsDeLecture('mot '.repeat(230))).toBe(1);
    expect(tempsDeLecture('mot '.repeat(231))).toBe(2);
  });
});

describe('sommaire', () => {
  it('garde les H2 et H3 dans l’ordre', () => {
    expect(
      sommaire([
        { depth: 1, slug: 'titre', text: 'Titre' },
        { depth: 2, slug: 'formule', text: 'La formule' },
        { depth: 3, slug: 'exemple', text: 'Un exemple' },
        { depth: 4, slug: 'detail', text: 'Détail' },
      ]),
    ).toEqual([
      { ancre: 'formule', texte: 'La formule', niveau: 1 },
      { ancre: 'exemple', texte: 'Un exemple', niveau: 2 },
    ]);
    expect(sommaire([])).toEqual([]);
  });
});
