import { act, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { CompteProvider } from '@/compte/CompteContext';
import { clientMemoire } from '@/compte/memoire';
import { GestionProvider, useGestion, type ContexteGestion } from '@/gestion/GestionContext';
import { clientGestionMemoire } from '@/gestion/memoire';

import { ETAT_SEPTEMBRE } from './gestion-exemples';

let courant: ContexteGestion | undefined;

function Sonde(): JSX.Element {
  courant = useGestion();
  return <span data-testid="statut">{courant.statut}</span>;
}

function contexte(): ContexteGestion {
  if (courant === undefined) throw new Error('contexte absent');
  return courant;
}

describe('GestionProvider : modifier et supprimer', () => {
  it('la location modifiée remplace l’ancienne ; le bien supprimé quitte l’état avec ce qui en dépend ; refusés, rien ne change', async () => {
    courant = undefined;
    render(
      <CompteProvider
        client={clientMemoire({
          utilisateur: { id: 'u1', nom: 'Camille Roux', email: 'camille@example.org', image: null },
        })}
      >
        <GestionProvider client={clientGestionMemoire({ etat: ETAT_SEPTEMBRE })}>
          <Sonde />
        </GestionProvider>
      </CompteProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('statut')).toHaveTextContent('pret');
    });

    await act(async () => {
      expect((await contexte().modifierLocation('location-julie', { jourLoyer: 40 })).ok).toBe(
        false,
      );
      expect((await contexte().modifierLocation('location-julie', { jourLoyer: 10 })).ok).toBe(
        true,
      );
    });
    expect(contexte().donnees?.locations.map((l) => l.jourLoyer)).toEqual([10, 3]);

    await act(async () => {
      const refuse = await contexte().modifierLocataire('locataire-antoine', {
        prenom: '',
        nom: 'Dupond',
      });
      expect(refuse.ok).toBe(false);
      const corrige = await contexte().modifierLocataire('locataire-antoine', {
        prenom: 'Antoine',
        nom: 'Dupond',
        email: 'antoine@exemple.fr',
      });
      expect(corrige.ok).toBe(true);
    });
    expect(contexte().donnees?.locataires.map((l) => l.nom)).toEqual(['Martin', 'Dupond']);

    await act(async () => {
      expect((await contexte().supprimerBien('inconnu')).ok).toBe(false);
      expect((await contexte().supprimerBien('bien-lices')).ok).toBe(true);
    });
    expect(contexte().donnees?.biens.map((b) => b.id)).toEqual(['bien-baille']);
    expect(contexte().donnees?.locataires.map((l) => l.prenom)).toEqual(['Antoine']);
    expect(contexte().donnees?.paiements).toEqual([]);
  });
});
