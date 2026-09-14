import { describe, expect, it } from 'vitest';

import { ACTION_PARTAGE, strategiePour, type Strategie } from '@/hors-ligne';

import { assemblage, auHasard, tirage } from './tirage';

const ORIGINE = 'https://loupeprojet.pages.dev';
const ORIGINES = [
  ORIGINE,
  'https://loupe-worker.erreip-gorguel.workers.dev',
  'http://loupeprojet.pages.dev',
  '',
];
const MORCEAUX_DE_CHEMIN = [
  '/',
  '/api/',
  'auth/get-session',
  '/assets/',
  'index-Ab12.js',
  ACTION_PARTAGE,
  '?texte=T3',
  '&lien=https%3A%2F%2Fexemple.fr',
  '/sw.js',
  '/capture.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '#p=abc',
  '%',
  '..',
  '/extension',
];
const METHODES = ['GET', 'POST', 'HEAD', 'get', 'PUT'];
const MODES = ['navigate', 'cors', 'no-cors', 'same-origin'];
const STRATEGIES: ReadonlySet<Strategie> = new Set<Strategie>([
  'navigation',
  'coque-d-abord',
  'cache-d-abord',
  'reseau-d-abord',
  'ignorer',
]);
const NB_CAS = 500;

/** Ce qu'une stratégie autre que « ignorer » ne doit jamais toucher. */
function ecartsDe(
  requete: { url: string; methode: string; mode: string },
  strategie: Strategie,
): string[] {
  if (strategie === 'ignorer') return [];
  const cible = new URL(requete.url);
  const regles: [boolean, string][] = [
    [requete.methode !== 'GET', 'hors GET'],
    [cible.origin !== ORIGINE, 'autre origine'],
    [cible.pathname.startsWith('/api/'), 'API des comptes'],
    [
      strategie === 'coque-d-abord' && (requete.mode !== 'navigate' || cible.search === ''),
      'coque sans partage',
    ],
  ];
  return regles.filter(([viole]) => viole).map(([, nom]) => nom);
}

describe('strategiePour sur des requêtes tirées au hasard', () => {
  it('une stratégie connue, jamais de cache hors GET, hors origine ou pour l’API', () => {
    const hasard = tirage(20_260_914);
    const ecarts: string[] = [];
    for (let i = 0; i < NB_CAS; i += 1) {
      const requete = {
        url: auHasard(hasard, ORIGINES) + assemblage(hasard, MORCEAUX_DE_CHEMIN, 4),
        methode: auHasard(hasard, METHODES),
        mode: auHasard(hasard, MODES),
      };
      const strategie = strategiePour(requete, ORIGINE);
      const problemes = STRATEGIES.has(strategie)
        ? ecartsDe(requete, strategie)
        : ['stratégie inconnue'];
      for (const probleme of problemes) {
        ecarts.push(
          `${probleme} : ${requete.methode} ${requete.mode} ${requete.url} → ${strategie}`,
        );
      }
    }
    expect(ecarts).toEqual([]);
  });
});
