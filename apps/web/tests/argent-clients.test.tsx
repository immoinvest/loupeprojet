import type { Depense, NouvelleDepense, PretBien } from '@loupe/gestion';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CompteProvider } from '@/compte/CompteContext';
import { clientMemoire } from '@/compte/memoire';
import type { ClientCompte, Utilisateur } from '@/compte/types';
import { ArgentProvider, useArgent, type ContexteArgent } from '@/gestion/argent/ArgentContext';
import { clientArgentMemoire } from '@/gestion/argent/memoire';
import { clientArgentReseau } from '@/gestion/argent/reseau';
import type { ClientArgent } from '@/gestion/argent/types';
import type { Recuperateur } from '@/gestion/reseau';

const H = '2026-09-14T09:00:00.000Z';
const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

const NOUVELLE: NouvelleDepense = {
  bienId: 'bien-lices',
  categorie: 'taxe_fonciere',
  montant: 84_000,
  date: '2026-10-15',
  recuperable: false,
};
const DEPENSE: Depense = { id: 'd1', ...NOUVELLE, creeLe: H, modifieLe: H };
const PRET: PretBien = {
  capital: 15_000_000,
  tauxAnnuel: 0.0335,
  dureeMois: 300,
  debut: '2026-11',
  assuranceMensuelle: 3_125,
};

function json(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });
}

function serveur(reponse: () => Response): {
  recuperer: Recuperateur;
  appels: { url: string; init: RequestInit | undefined }[];
} {
  const appels: { url: string; init: RequestInit | undefined }[] = [];
  return {
    appels,
    recuperer: (url, init) => {
      appels.push({ url, init });
      return Promise.resolve(reponse());
    },
  };
}

describe('clientArgentReseau', () => {
  it('chemins, méthodes et corps de chaque action ; réponses revalidées', async () => {
    const etat = serveur(() => json(200, { depenses: [DEPENSE], prets: [] }));
    expect(await clientArgentReseau(etat.recuperer).etat()).toEqual({
      ok: true,
      valeur: { depenses: [DEPENSE], prets: [] },
    });
    expect(etat.appels).toEqual([{ url: '/api/gestion/argent', init: { method: 'GET' } }]);

    const depense = serveur(() => json(201, DEPENSE));
    const client = clientArgentReseau(depense.recuperer);
    expect((await client.ajouterDepense(NOUVELLE)).ok).toBe(true);
    expect((await client.modifierDepense('d 1', NOUVELLE)).ok).toBe(true);
    expect(depense.appels.map((a) => [a.url, a.init?.method, a.init?.body])).toEqual([
      ['/api/gestion/depenses', 'POST', JSON.stringify(NOUVELLE)],
      ['/api/gestion/depenses/d%201', 'PATCH', JSON.stringify(NOUVELLE)],
    ]);

    const vide = serveur(() => new Response(null, { status: 204 }));
    const sansCorps = clientArgentReseau(vide.recuperer);
    expect(await sansCorps.supprimerDepense('d1')).toEqual({ ok: true, valeur: undefined });
    expect(await sansCorps.supprimerPret('bien-lices')).toEqual({ ok: true, valeur: undefined });
    expect(vide.appels.map((a) => [a.url, a.init?.method])).toEqual([
      ['/api/gestion/depenses/d1', 'DELETE'],
      ['/api/gestion/biens/bien-lices/pret', 'DELETE'],
    ]);

    const pret = serveur(() => json(200, { ...PRET, bienId: 'bien-lices', modifieLe: H }));
    expect((await clientArgentReseau(pret.recuperer).enregistrerPret('bien-lices', PRET)).ok).toBe(
      true,
    );
    expect(pret.appels[0]?.init?.method).toBe('PUT');
  });

  it('erreurs : codes connus, 503 sans code, 400 inconnu, réponse invalide, réseau coupé', async () => {
    const code = async (reponse: () => Response): Promise<unknown> =>
      clientArgentReseau(serveur(reponse).recuperer).etat();
    expect(await code(() => json(503, { code: 'DEPENSES_INDISPONIBLE' }))).toEqual({
      ok: false,
      code: 'indisponible',
    });
    expect(await code(() => json(409, { code: 'LIMITE_ATTEINTE' }))).toEqual({
      ok: false,
      code: 'limite',
    });
    expect(await code(() => new Response('panne', { status: 502 }))).toEqual({
      ok: false,
      code: 'indisponible',
    });
    expect(await code(() => json(418, { code: 'THE' }))).toEqual({ ok: false, code: 'inconnue' });
    expect(await code(() => json(200, { depenses: 'non' }))).toEqual({
      ok: false,
      code: 'inconnue',
    });
    expect(await code(() => new Response('pas du json', { status: 200 }))).toEqual({
      ok: false,
      code: 'inconnue',
    });
    const coupe: Recuperateur = () => Promise.reject(new Error('hors ligne'));
    expect(await clientArgentReseau(coupe).etat()).toEqual({ ok: false, code: 'reseau' });
  });

  it('par défaut, le fetch du navigateur', async () => {
    const avant = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(json(200, { depenses: [], prets: [] }));
    try {
      expect((await clientArgentReseau().etat()).ok).toBe(true);
    } finally {
      globalThis.fetch = avant;
    }
  });
});

describe('clientArgentMemoire', () => {
  it('ajoute, modifie, supprime ; enregistre et remplace un prêt ; mêmes refus que l’API', async () => {
    const client = clientArgentMemoire({ limite: 1, maintenant: H });
    expect(await client.ajouterDepense({ ...NOUVELLE, montant: 0 })).toEqual({
      ok: false,
      code: 'invalide',
    });
    const ajout = await client.ajouterDepense(NOUVELLE);
    expect(ajout).toEqual({ ok: true, valeur: { ...DEPENSE, id: 'depense-1' } });
    expect(await client.ajouterDepense(NOUVELLE)).toEqual({ ok: false, code: 'limite' });

    expect(await client.modifierDepense('depense-1', { ...NOUVELLE, date: 'hier' })).toEqual({
      ok: false,
      code: 'invalide',
    });
    expect(await client.modifierDepense('inconnue', NOUVELLE)).toEqual({
      ok: false,
      code: 'introuvable',
    });
    const modifiee = await client.modifierDepense('depense-1', { ...NOUVELLE, montant: 91_000 });
    expect(modifiee.ok && modifiee.valeur.montant).toBe(91_000);
    expect(client.donnees().depenses[0]?.montant).toBe(91_000);
    expect(await client.supprimerDepense('inconnue')).toEqual({ ok: false, code: 'introuvable' });
    expect(await client.supprimerDepense('depense-1')).toEqual({ ok: true, valeur: undefined });

    expect(await client.enregistrerPret('bien-lices', { ...PRET, dureeMois: 0 })).toEqual({
      ok: false,
      code: 'invalide',
    });
    await client.enregistrerPret('bien-lices', PRET);
    await client.enregistrerPret('bien-lices', { ...PRET, tauxAnnuel: 0.031 });
    expect(client.donnees().prets).toEqual([
      { ...PRET, tauxAnnuel: 0.031, bienId: 'bien-lices', modifieLe: H },
    ]);
    expect(await client.supprimerPret('bien-baille')).toEqual({ ok: false, code: 'introuvable' });
    expect(await client.supprimerPret('bien-lices')).toEqual({ ok: true, valeur: undefined });

    const enPanne = clientArgentMemoire({ erreurs: { etat: 'indisponible' } });
    expect(await enPanne.etat()).toEqual({ ok: false, code: 'indisponible' });
    expect(enPanne.appels).toEqual(['etat']);
    expect((await clientArgentMemoire().etat()).ok).toBe(true);
  });
});

let courant: ContexteArgent | undefined;

function Sonde(): JSX.Element {
  courant = useArgent();
  return <span data-testid="statut">{courant.statut}</span>;
}

function contexte(): ContexteArgent {
  if (courant === undefined) throw new Error('contexte absent');
  return courant;
}

function monter(
  argent: ClientArgent,
  compte: ClientCompte = clientMemoire({ utilisateur: CAMILLE }),
): void {
  courant = undefined;
  render(
    <CompteProvider client={compte}>
      <ArgentProvider client={argent}>
        <Sonde />
      </ArgentProvider>
    </CompteProvider>,
  );
}

async function statut(attendu: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('statut')).toHaveTextContent(attendu);
  });
}

describe('ArgentProvider', () => {
  it('sans compte : rien n’est lu ; une action n’abîme pas un état absent', async () => {
    const argent = clientArgentMemoire();
    monter(argent, clientMemoire());
    await statut('anonyme');
    expect(contexte()).toMatchObject({ donnees: null, erreur: null });
    await act(async () => {
      await contexte().ajouterDepense(NOUVELLE);
    });
    expect(contexte().donnees).toBeNull();
    expect(argent.appels).toEqual(['ajouterDepense']);
  });

  it('connecté : lit dépenses et prêts, puis chaque action tient l’état à jour', async () => {
    const argent = clientArgentMemoire({ etat: { depenses: [DEPENSE], prets: [] } });
    monter(argent);
    await statut('pret');
    await act(async () => {
      await contexte().ajouterDepense({ ...NOUVELLE, montant: 1_000 });
      await contexte().modifierDepense('d1', { ...NOUVELLE, montant: 2_000 });
      await contexte().enregistrerPret('bien-lices', PRET);
      await contexte().enregistrerPret('bien-lices', { ...PRET, dureeMois: 240 });
    });
    expect(contexte().donnees?.depenses.map((d) => d.montant)).toEqual([2_000, 1_000]);
    expect(contexte().donnees?.prets.map((p) => p.dureeMois)).toEqual([240]);
    await act(async () => {
      await contexte().supprimerDepense('d1');
      await contexte().supprimerPret('bien-lices');
      // Un refus ne change rien.
      await contexte().supprimerPret('bien-lices');
    });
    expect(contexte().donnees).toMatchObject({ prets: [] });
    expect(contexte().donnees?.depenses).toHaveLength(1);
  });

  it('migration absente : « indisponible » ; autre panne : « erreur », puis recharger', async () => {
    monter(clientArgentMemoire({ erreurs: { etat: 'indisponible' } }));
    await statut('indisponible');
    expect(contexte()).toMatchObject({ donnees: null, erreur: 'indisponible' });
  });

  it('autre panne : « erreur » avec son code ; recharger relit', async () => {
    let echecs = 1;
    const base = clientArgentMemoire();
    const capricieux: ClientArgent = {
      ...base,
      etat: () => {
        if (echecs > 0) {
          echecs -= 1;
          return Promise.resolve({ ok: false, code: 'reseau' });
        }
        return base.etat();
      },
    };
    monter(capricieux);
    await statut('erreur');
    expect(contexte().erreur).toBe('reseau');
    act(() => {
      contexte().recharger();
    });
    await statut('pret');
    expect(contexte().erreur).toBeNull();
  });

  it('hors du fournisseur : une erreur claire', () => {
    const silence = vi.spyOn(globalThis.console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => render(<Sonde />)).toThrow('useArgent doit être utilisé sous ArgentProvider');
    } finally {
      silence.mockRestore();
    }
  });
});
