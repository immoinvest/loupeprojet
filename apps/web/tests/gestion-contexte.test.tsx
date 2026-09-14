import { act, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { CompteProvider } from '@/compte/CompteContext';
import { clientMemoire } from '@/compte/memoire';
import type { ClientCompte, Utilisateur } from '@/compte/types';
import { GestionProvider, useGestion, type ContexteGestion } from '@/gestion/GestionContext';
import { clientGestionMemoire } from '@/gestion/memoire';
import { CLE_MENU } from '@/gestion/menu';
import type { ClientGestion } from '@/gestion/types';

import { CREATION_LOUEE, CREATION_VACANTE, ETAT_SEPTEMBRE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};
const PAIEMENT = {
  locationId: 'location-antoine',
  periode: '2026-09',
  montant: 43_000,
  date: '2026-09-14',
};

let courant: ContexteGestion | undefined;

function Sonde(): JSX.Element {
  courant = useGestion();
  return <span data-testid="statut">{courant.statut}</span>;
}

function contexte(): ContexteGestion {
  if (courant === undefined) throw new Error('contexte absent');
  return courant;
}

function monter(options: {
  compte?: ClientCompte;
  gestion?: ClientGestion;
  stockage?: Storage;
}): void {
  courant = undefined;
  render(
    <CompteProvider client={options.compte ?? clientMemoire({ utilisateur: CAMILLE })}>
      <GestionProvider
        client={options.gestion ?? clientGestionMemoire()}
        stockage={options.stockage}
      >
        <Sonde />
      </GestionProvider>
    </CompteProvider>,
  );
}

async function statut(attendu: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('statut')).toHaveTextContent(attendu);
  });
}

describe('GestionProvider', () => {
  it('sans compte : rien n’est lu, les deux sections malgré une copie locale qui masque Analyser', async () => {
    window.localStorage.setItem(CLE_MENU, JSON.stringify({ analyser: false, gerer: true }));
    const gestion = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    monter({ compte: clientMemoire(), gestion });
    await statut('anonyme');
    expect(contexte()).toMatchObject({
      donnees: null,
      erreur: null,
      sections: { analyser: true, gerer: true },
    });
    expect(gestion.appels).toEqual([]);
  });

  it('pendant le chargement du compte : la copie locale du menu s’applique déjà', async () => {
    window.localStorage.setItem(CLE_MENU, JSON.stringify({ analyser: false, gerer: true }));
    const enAttente: ClientCompte = {
      ...clientMemoire(),
      session: () => new Promise(() => undefined),
    };
    monter({ compte: enAttente });
    await statut('chargement');
    expect(contexte().sections).toEqual({ analyser: false, gerer: true });
  });

  it('connecté : lit l’état, retient les préférences du compte, localement aussi', async () => {
    const gestion = clientGestionMemoire({
      etat: { ...ETAT_SEPTEMBRE, preferences: { analyser: true, gerer: false } },
    });
    monter({ gestion, stockage: window.localStorage });
    await statut('pret');
    expect(contexte().donnees?.locations).toHaveLength(2);
    expect(contexte().preferences).toEqual({ analyser: true, gerer: false });
    expect(window.localStorage.getItem(CLE_MENU)).toBe(
      JSON.stringify({ analyser: true, gerer: false }),
    );
  });

  it('les actions réussies mettent l’état à jour ; les refusées ne changent rien', async () => {
    monter({ gestion: clientGestionMemoire({ etat: ETAT_SEPTEMBRE }) });
    await statut('pret');

    await act(async () => {
      expect((await contexte().creer(CREATION_LOUEE)).ok).toBe(true);
      expect((await contexte().creer(CREATION_VACANTE)).ok).toBe(true);
      expect((await contexte().creer({ ...CREATION_LOUEE, location: null })).ok).toBe(false);
    });
    expect(contexte().donnees).toMatchObject({ biens: { length: 4 }, locations: { length: 3 } });

    let paiementId = '';
    await act(async () => {
      const r = await contexte().payer(PAIEMENT);
      paiementId = r.ok ? r.valeur.id : '';
      expect((await contexte().payer(PAIEMENT)).ok).toBe(false);
    });
    expect(contexte().donnees?.paiements).toHaveLength(2);

    await act(async () => {
      expect((await contexte().annulerPaiement(paiementId)).ok).toBe(true);
      expect((await contexte().annulerPaiement('inconnu')).ok).toBe(false);
    });
    expect(contexte().donnees?.paiements.map((p) => p.id)).toEqual(['paiement-julie']);
  });

  it('erreur de lecture : statut erreur ; une action réussie n’invente pas de données ; recharger relit', async () => {
    const base = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    let lectures = 0;
    const gestion: ClientGestion = {
      ...base,
      etat: () => {
        lectures += 1;
        return lectures === 1 ? Promise.resolve({ ok: false, code: 'reseau' }) : base.etat();
      },
    };
    monter({ gestion });
    await statut('erreur');
    expect(contexte()).toMatchObject({ erreur: 'reseau', donnees: null });

    await act(async () => {
      expect((await contexte().payer(PAIEMENT)).ok).toBe(true);
    });
    expect(contexte().donnees).toBeNull();

    act(() => {
      contexte().recharger();
    });
    await statut('pret');
    expect(contexte()).toMatchObject({ erreur: null, donnees: { paiements: { length: 2 } } });
  });

  it('changer le menu : appliqué tout de suite et enregistré', async () => {
    const reussite = clientGestionMemoire();
    monter({ gestion: reussite });
    await statut('pret');
    await act(async () => {
      await contexte().changerPreferences({ analyser: false, gerer: true });
    });
    expect(contexte().sections).toEqual({ analyser: false, gerer: true });
    expect(contexte().donnees?.preferences).toEqual({ analyser: false, gerer: true });
    expect(reussite.donnees().preferences).toEqual({ analyser: false, gerer: true });
  });

  it('changer le menu : annulé si l’enregistrement échoue', async () => {
    monter({ gestion: clientGestionMemoire({ erreurs: { enregistrerPreferences: 'reseau' } }) });
    await statut('pret');
    await act(async () => {
      const r = await contexte().changerPreferences({ analyser: false, gerer: true });
      expect(r).toEqual({ ok: false, code: 'reseau' });
    });
    expect(contexte().preferences).toEqual({ analyser: true, gerer: true });
  });

  it('useGestion hors du fournisseur lève une erreur claire', () => {
    const Seule = (): JSX.Element => {
      useGestion();
      return <span />;
    };
    expect(() => render(<Seule />)).toThrow('useGestion doit être utilisé sous GestionProvider');
  });
});
