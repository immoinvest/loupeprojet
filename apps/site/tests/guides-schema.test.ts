import { describe, expect, it } from 'vitest';

import { CATEGORIES, LISTE_CATEGORIES, SLUGS_CATEGORIES } from '../src/lib/guides/categories';
import { SchemaGuide } from '../src/lib/guides/schema';

const GUIDE = {
  titre: 'Calcul de la rentabilité locative : brut, net et net-net',
  titreSeo: 'Calcul rentabilité locative : brut, net, net-net (exemple)',
  description:
    'Comment calculer la rentabilité locative brute, nette et net-net ? Formules, exemple chiffré et simulateur gratuit à partir de votre annonce immobilière.',
  motCle: 'rentabilité locative calcul',
  categorie: 'investir',
  auteur: 'pierre-georgel',
  publieLe: '2026-09-15',
  misAJourLe: '2026-09-15',
  essentiel: [
    'La rentabilité brute divise les loyers annuels par le coût total du projet.',
    'La rentabilité nette retire les charges du propriétaire et la vacance.',
    'La rentabilité net-net retire aussi les intérêts du crédit et l’impôt.',
  ],
  faq: [
    {
      question: 'Quelle est une bonne rentabilité locative ?',
      reponse: 'Elle dépend de la ville et du risque accepté ; regardez aussi le cash-flow.',
    },
    {
      question: 'Faut-il compter la taxe foncière ?',
      reponse: 'Oui, dans la rentabilité nette, avec les autres charges du propriétaire.',
    },
  ],
  sources: [
    {
      nom: 'Service-public.gouv.fr',
      url: 'https://www.service-public.gouv.fr/',
      consulteLe: '2026-09-15',
    },
  ],
};

describe('catégories', () => {
  it('décrivent chaque catégorie en 120 à 160 caractères, dans l’ordre des slugs', () => {
    expect(LISTE_CATEGORIES.map((c) => c.slug)).toEqual([...SLUGS_CATEGORIES]);
    for (const slug of SLUGS_CATEGORIES) {
      const { description, titre } = CATEGORIES[slug];
      expect(description.length, slug).toBeGreaterThanOrEqual(120);
      expect(description.length, slug).toBeLessThanOrEqual(160);
      expect(titre.length, slug).toBeLessThanOrEqual(65);
    }
  });
});

describe('SchemaGuide', () => {
  it('accepte un guide complet et remplit les valeurs par défaut', () => {
    const guide = SchemaGuide.parse(GUIDE);
    expect(guide.brouillon).toBe(false);
    expect(guide.motsClesSecondaires).toEqual([]);
    expect(guide.publieLe).toBeInstanceOf(Date);
  });

  it.each([
    ['description', { description: 'Trop courte pour Google.' }],
    ['description', { description: 'x'.repeat(161) }],
    ['titreSeo', { titreSeo: 'x'.repeat(66) }],
    ['categorie', { categorie: 'crypto' }],
    ['auteur', { auteur: 'quelqu-un' }],
    ['essentiel', { essentiel: ['Une seule phrase ne suffit pas à résumer.'] }],
    ['faq', { faq: [] }],
    ['sources', { sources: [] }],
    ['misAJourLe', { misAJourLe: '2026-09-01' }],
  ])('refuse un guide dont « %s » est invalide', (champ, changement) => {
    const resultat = SchemaGuide.safeParse({ ...GUIDE, ...changement });
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues.map((i) => i.path[0])).toContain(champ);
  });

  it('refuse une source qui n’est pas en https', () => {
    const resultat = SchemaGuide.safeParse({
      ...GUIDE,
      sources: [{ nom: 'Ancien site', url: 'http://www.example.fr/', consulteLe: '2026-09-15' }],
    });
    expect(resultat.success).toBe(false);
  });
});
