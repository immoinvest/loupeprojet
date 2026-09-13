import { creerApp } from '../src/app';
import type { Dependances } from '../src/dependances';
import { journalMemoire } from '../src/journal';
import { cacheMemoire } from '../src/proxy/cache';
import { limiteurMemoire } from '../src/proxy/debit';
import { SERVICES } from '../src/services';

/** Réponse Géoplateforme réaliste pour « 8 boulevard du Port, Amiens ». */
export const REPONSE_GEOPLATEFORME = {
  type: 'FeatureCollection',
  version: 'draft',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.290471, 49.897443] },
      properties: {
        label: '8 Boulevard du Port 80000 Amiens',
        score: 0.9587,
        housenumber: '8',
        id: '80021_6590_00008',
        type: 'housenumber',
        name: '8 Boulevard du Port',
        postcode: '80000',
        citycode: '80021',
        x: 648952.58,
        y: 6977867.25,
        city: 'Amiens',
        context: '80, Somme, Hauts-de-France',
        importance: 0.6706,
        street: 'Boulevard du Port',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.3, 49.9] },
      properties: {
        label: 'Boulevard du Port 80000 Amiens',
        score: 0.8,
        type: 'street',
        name: 'Boulevard du Port',
        postcode: '80000',
        citycode: '80021',
        city: 'Amiens',
      },
    },
  ],
  attribution: 'BAN',
  licence: 'ETALAB-2.0',
  query: '8 bd du port amiens',
  limit: 5,
};

export function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json' },
  });
}

export interface Banc {
  readonly deps: Dependances;
  readonly journal: ReturnType<typeof journalMemoire>;
  readonly appels: URL[];
  readonly horloge: { valeur: number };
  readonly requete: (chemin: string, init?: RequestInit) => Promise<Response>;
}

/** Une application avec des doubles : cache mémoire, limiteur mémoire, amont simulé, horloge pilotée. */
export function banc(surcharges: Partial<Dependances> = {}, limite = 60): Banc {
  const horloge = { valeur: Date.parse('2026-09-13T10:00:00Z') };
  const maintenant = (): number => horloge.valeur;
  const journal = journalMemoire();
  const appels: URL[] = [];
  const deps: Dependances = {
    environnement: 'dev',
    origines: ['https://loupeprojet.pages.dev', 'http://localhost:5173'],
    services: SERVICES,
    cache: cacheMemoire(maintenant),
    limiteur: limiteurMemoire(limite, 60, maintenant),
    fetcher: (url) => {
      appels.push(url);
      return Promise.resolve(reponseJson(REPONSE_GEOPLATEFORME));
    },
    maintenant,
    journal,
    ...surcharges,
  };
  const app = creerApp(deps);
  return {
    deps,
    journal,
    appels,
    horloge,
    requete: (chemin, init) =>
      Promise.resolve(
        app.request(chemin, { headers: { 'CF-Connecting-IP': '203.0.113.7' }, ...init }),
      ),
  };
}
