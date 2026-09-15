import type { EtatEnvois } from '@loupe/gestion';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { CompteProvider } from '@/compte/CompteContext';
import { clientMemoire } from '@/compte/memoire';
import { EnvoisProvider, useEnvois } from '@/gestion/envois/EnvoisContext';
import {
  clientAccordMemoire,
  clientEnvoisIndisponible,
  clientEnvoisMemoire,
  ETAT_ENVOIS_VIDE,
} from '@/gestion/envois/memoire';
import type { ClientEnvois, ResultatEnvois } from '@/gestion/envois/types';

import { JETON } from './envois-exemples';

const CAMILLE = { id: 'u1', nom: 'Camille', email: 'camille@example.org', image: null };

const ETAT: EtatEnvois = {
  ...ETAT_ENVOIS_VIDE,
  accords: [
    { locataireId: 'julie', statut: 'non_demande' },
    { locataireId: 'lea', statut: 'en_attente', invitationLe: '2026-09-14T09:00:00.000Z' },
  ],
  envois: [
    {
      id: 'e1',
      documentId: 'd1',
      locataireId: 'julie',
      destinataire: 'julie@…',
      statut: 'echec',
      tentatives: 1,
      dernierEssaiLe: '2026-09-14T09:00:00.000Z',
    },
  ],
};

function Sonde(): JSX.Element {
  const envois = useEnvois();
  const [retour, setRetour] = useState('');
  const noter = (promesse: Promise<ResultatEnvois<unknown>>): void => {
    void promesse.then((r) => {
      setRetour(r.ok ? 'ok' : r.code);
    });
  };
  const actions: readonly [string, () => void][] = [
    ['recharger', envois.recharger],
    [
      'plus tard',
      () => {
        envois.rechargerDans(5);
      },
    ],
    [
      'tel',
      () => {
        noter(envois.enregistrerContact('julie', '0612345678'));
      },
    ],
    [
      'sans tel',
      () => {
        noter(envois.enregistrerContact('julie', null));
      },
    ],
    [
      'sci',
      () => {
        noter(envois.enregistrerBailleurBien('bien', { type: 'sci', nom: 'SCI', adresse: 'A' }));
      },
    ],
    [
      'sans sci',
      () => {
        noter(envois.enregistrerBailleurBien('bien', null));
      },
    ],
    [
      'renvoyer',
      () => {
        noter(envois.renvoyer('d1'));
      },
    ],
    [
      'declarer',
      () => {
        noter(envois.declarerAccord('julie'));
      },
    ],
    [
      'inviter',
      () => {
        noter(envois.inviter('lea'));
      },
    ],
  ];
  return (
    <div>
      <p data-testid="statut">{envois.statut}</p>
      <p data-testid="erreur">{envois.erreur ?? ''}</p>
      <p data-testid="retour">{retour}</p>
      <p data-testid="donnees">
        {JSON.stringify(
          envois.donnees === null
            ? null
            : {
                accords: envois.donnees.accords.map((a) => a.statut),
                contacts: envois.donnees.contacts.length,
                bailleurs: envois.donnees.bailleursBiens.length,
                tentatives: envois.donnees.envois.map((e) => e.tentatives),
              },
        )}
      </p>
      {actions.map(([nom, agir]) => (
        <button key={nom} type="button" onClick={agir}>
          {nom}
        </button>
      ))}
    </div>
  );
}

function monter(client: ClientEnvois, connecte = true): () => void {
  const { unmount } = render(
    <CompteProvider client={clientMemoire(connecte ? { utilisateur: CAMILLE } : {})}>
      <EnvoisProvider client={client} accord={clientAccordMemoire()}>
        <Sonde />
      </EnvoisProvider>
    </CompteProvider>,
  );
  return unmount;
}

const texte = (id: string): string => screen.getByTestId(id).textContent;

async function cliquer(nom: string, retour: string): Promise<void> {
  await userEvent.setup().click(screen.getByRole('button', { name: nom }));
  await waitFor(() => {
    expect(texte('retour')).toBe(retour);
  });
}

describe('EnvoisProvider', () => {
  it('prêt, puis chaque action tient l’état à jour', async () => {
    monter(clientEnvoisMemoire({ etat: ETAT }));
    await waitFor(() => {
      expect(texte('statut')).toBe('pret');
    });
    expect(texte('erreur')).toBe('');
    await cliquer('tel', 'ok');
    expect(JSON.parse(texte('donnees'))).toMatchObject({ contacts: 1 });
    await cliquer('sci', 'ok');
    expect(JSON.parse(texte('donnees'))).toMatchObject({ bailleurs: 1 });
    await cliquer('renvoyer', 'ok');
    expect(JSON.parse(texte('donnees'))).toMatchObject({ tentatives: [2] });
    await cliquer('declarer', 'ok');
    expect(JSON.parse(texte('donnees'))).toMatchObject({
      accords: ['declare_par_bailleur', 'en_attente'],
    });
    await cliquer('inviter', 'invitation_recente');
    await cliquer('sans tel', 'ok');
    await cliquer('sans sci', 'ok');
    expect(JSON.parse(texte('donnees'))).toMatchObject({ contacts: 0, bailleurs: 0 });
  });

  it('un échec ne change rien à l’état', async () => {
    monter(
      clientEnvoisMemoire({
        etat: ETAT,
        erreurs: {
          enregistrerContact: 'reseau',
          enregistrerBailleurBien: 'reseau',
          renvoyer: 'envoi_recent',
        },
      }),
    );
    await waitFor(() => {
      expect(texte('statut')).toBe('pret');
    });
    await cliquer('tel', 'reseau');
    await cliquer('sci', 'reseau');
    await cliquer('renvoyer', 'envoi_recent');
    expect(JSON.parse(texte('donnees'))).toEqual({
      accords: ['non_demande', 'en_attente'],
      contacts: 0,
      bailleurs: 0,
      tentatives: [1],
    });
  });

  it('« recharger » relit l’état tout de suite, « plus tard » après un délai', async () => {
    const client = clientEnvoisMemoire({ etat: ETAT });
    monter(client);
    const lectures = (): number => client.appels.filter((a) => a === 'etat').length;
    await waitFor(() => {
      expect(lectures()).toBe(1);
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'recharger' }));
    await waitFor(() => {
      expect(lectures()).toBe(2);
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'plus tard' }));
    await waitFor(() => {
      expect(lectures()).toBe(3);
    });
  });

  it('indisponible, en erreur, sans compte', async () => {
    const demonter = monter(clientEnvoisIndisponible());
    await waitFor(() => {
      expect(texte('statut')).toBe('indisponible');
    });
    expect(texte('erreur')).toBe('indisponible');
    demonter();

    const enErreur = monter(clientEnvoisMemoire({ erreurs: { etat: 'reseau' } }));
    await waitFor(() => {
      expect(texte('statut')).toBe('erreur');
    });
    expect(texte('erreur')).toBe('reseau');
    // Sans données chargées, une action réussie ne fabrique pas d'état.
    await cliquer('tel', 'ok');
    expect(texte('donnees')).toBe('null');
    enErreur();

    monter(clientEnvoisMemoire({ etat: ETAT }), false);
    expect(texte('statut')).toBe('inactif');
    expect(texte('erreur')).toBe('');
  });

  it('sans fournisseur, tout répond « indisponible » sans rien casser', async () => {
    const { result } = renderHook(() => useEnvois());
    const envois = result.current;
    expect(envois.statut).toBe('indisponible');
    expect(() => {
      envois.recharger();
      envois.rechargerDans(1);
    }).not.toThrow();
    const reponses = await Promise.all([
      envois.declarerAccord('x'),
      envois.inviter('x'),
      envois.enregistrerContact('x', null),
      envois.enregistrerBailleurBien('x', null),
      envois.renvoyer('x'),
      envois.accord.lire(JETON),
      envois.accord.repondre(JETON, 'accorde'),
    ]);
    for (const r of reponses) expect(r).toEqual({ ok: false, code: 'indisponible' });
  });
});
