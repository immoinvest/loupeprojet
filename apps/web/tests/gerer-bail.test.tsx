import type { EtatGestion } from '@loupe/gestion';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { clientBailMemoire } from '@/gestion/bail/memoire';
import type { ClientBail } from '@/gestion/bail/types';
import { clientGestionMemoire, type ClientGestionMemoire } from '@/gestion/memoire';
import { TEXTES_A_FAIRE } from '@/textes/gerer-a-faire';
import {
  TEXTES_BAIL,
  TEXTES_CONFORMITE,
  TEXTES_LETTRE,
  TEXTES_REVISION,
} from '@/textes/gerer-bail';
import { TEXTES_BAILLEUR } from '@/textes/gerer-bailleur';

import { BAILLEUR, BIEN_BAILLE, BIEN_LICES, ETAT_SEPTEMBRE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};
const MAINTENANT = '2026-09-14T09:00:00.000Z';
const ATTENTE = { timeout: 10_000 };

/** Les montants et pourcentages portent des espaces insécables : comparés en espaces simples. */
const simple = (texte: string | null): string => (texte ?? '').replace(/\s/g, ' ');

function avec(etat: Partial<EtatGestion>): { gestion: ClientGestionMemoire; bail: ClientBail } {
  const gestion = clientGestionMemoire({
    etat: { ...ETAT_SEPTEMBRE, ...etat },
    maintenant: MAINTENANT,
  });
  return { gestion, bail: clientBailMemoire({ gestion, maintenant: MAINTENANT }) };
}

function monter(
  chemin: string,
  clients: { gestion: ClientGestionMemoire; bail?: ClientBail },
): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire({ utilisateur: CAMILLE })}
      gestion={clients.gestion}
      {...(clients.bail === undefined ? {} : { bail: clients.bail })}
    />,
  );
}

async function carte(titre: string): Promise<HTMLElement> {
  const entete = await screen.findByRole('heading', { level: 2, name: titre }, ATTENTE);
  const section = entete.closest('section');
  if (section === null) throw new Error(`carte ${titre} absente`);
  return section;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fiche du bien : conformité et révision', () => {
  it('DPE repris de l’analyse ; classé G par le bailleur : alerte datée, loyer gelé', async () => {
    const utilisateur = userEvent.setup();
    const lices = { ...BIEN_LICES, codePostal: '13005', projet: { bien: { dpe: 'D' } } };
    monter('/gerer/biens/bien-lices', avec({ bailleur: BAILLEUR, biens: [lices, BIEN_BAILLE] }));

    const conformite = await carte(TEXTES_CONFORMITE.titre);
    expect(within(conformite).getByText('Classe D')).toBeInTheDocument();
    expect(within(conformite).getByText('analyse')).toBeInTheDocument();
    const revision = await carte(TEXTES_REVISION.titre);
    expect(simple(within(revision).getByText(/→/).textContent)).toBe('650 € → 657,49 € (+1,15 %)');
    expect(within(revision).getByRole('link', { name: TEXTES_REVISION.source })).toHaveAttribute(
      'href',
      'https://www.insee.fr/fr/statistiques/9022797',
    );

    await utilisateur.click(
      within(conformite).getByRole('button', { name: TEXTES_CONFORMITE.modifier }),
    );
    const formulaire = within(conformite).getByRole('form', { name: TEXTES_CONFORMITE.formulaire });
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: `${TEXTES_CONFORMITE.classe} D` }),
    );
    await utilisateur.click(screen.getByRole('option', { name: 'G' }));
    await utilisateur.type(
      within(formulaire).getByLabelText(TEXTES_CONFORMITE.dateDpe),
      '2016-06-01',
    );
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_CONFORMITE.enregistrer }),
    );

    const alertes = await within(conformite).findByRole(
      'list',
      { name: TEXTES_CONFORMITE.alertes },
      ATTENTE,
    );
    expect(
      within(alertes)
        .getAllByRole('listitem')
        .map((l) => l.textContent),
    ).toEqual([
      'Classe G : nouveau bail et renouvellement interdits depuis le 1er janvier 2025.',
      expect.stringMatching(/^DPE plus valable depuis le 1er janvier 2023/),
    ]);
    expect(within(conformite).getByText('à toi')).toBeInTheDocument();
    expect(within(revision).getByText(/^Loyer gelé : logement classé G/)).toBeInTheDocument();
    expect(within(revision).queryByRole('button', { name: TEXTES_REVISION.appliquer })).toBeNull();
  });

  it('sans identité du bailleur : demandée une fois, puis la révision s’applique', async () => {
    const utilisateur = userEvent.setup();
    const clients = avec({});
    monter('/gerer/biens/bien-lices', clients);
    const revision = await carte(TEXTES_REVISION.titre);
    await utilisateur.click(
      within(revision).getByRole('button', { name: TEXTES_REVISION.appliquer }),
    );
    const identite = within(revision).getByRole('form', { name: TEXTES_BAILLEUR.titre });
    await utilisateur.type(within(identite).getByLabelText(TEXTES_BAILLEUR.nom), BAILLEUR.nom);
    await utilisateur.type(
      within(identite).getByLabelText(TEXTES_BAILLEUR.adresse),
      BAILLEUR.adresse,
    );
    await utilisateur.click(
      within(identite).getByRole('button', { name: TEXTES_BAILLEUR.enregistrer }),
    );
    const statut = await within(revision).findByRole('status', {}, ATTENTE);
    expect(simple(statut.textContent)).toMatch(
      /^Révision appliquée : 657,49 € à partir d’octobre 2026\./,
    );
    expect(clients.gestion.donnees().bailleur).toEqual(BAILLEUR);
  });
});

describe('réglages de la révision', () => {
  it('« Non » : la révision est désactivée pour cette location', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer/biens/bien-baille', avec({ bailleur: BAILLEUR }));
    const revision = await carte(TEXTES_REVISION.titre);
    expect(within(revision).getByText('par défaut')).toBeInTheDocument();
    await utilisateur.click(
      within(revision).getByRole('button', { name: TEXTES_REVISION.reglages }),
    );
    const formulaire = within(revision).getByRole('form', { name: TEXTES_REVISION.formulaire });
    await utilisateur.click(
      within(formulaire).getByRole('button', {
        name: `${TEXTES_REVISION.active} ${TEXTES_REVISION.activeOui}`,
      }),
    );
    await utilisateur.click(screen.getByRole('option', { name: TEXTES_REVISION.activeNon }));
    await utilisateur.click(
      within(formulaire).getByRole('button', { name: TEXTES_REVISION.enregistrer }),
    );
    expect(
      await within(revision).findByText('Révision désactivée pour cette location.', {}, ATTENTE),
    ).toBeInTheDocument();
    expect(within(revision).queryByText('par défaut')).toBeNull();
  });
});

describe('« À faire » et lettre de révision', () => {
  it('révisions après les e-mails ; deux clics jusqu’à la révision appliquée ; la lettre s’imprime', async () => {
    const utilisateur = userEvent.setup();
    const clients = avec({ bailleur: BAILLEUR });
    monter('/gerer', clients);
    const liste = await screen.findByRole('list', { name: TEXTES_A_FAIRE.titre }, ATTENTE);
    await utilisateur.click(screen.getByRole('button', { name: 'Voir l’autre' }));
    const lignes = within(liste)
      .getAllByRole('listitem')
      .map((l) => simple(l.textContent));
    expect(lignes).toEqual([
      expect.stringMatching(/^Loyer d’Antoine en retard/),
      'Ajouter l’e-mail d’Antoine Dupont',
      'Réviser le loyer d’Antoine : 400 € → 404,61 €Studio Baille',
      'Réviser le loyer de Julie : 650 € → 657,49 €T2 Lices',
    ]);

    let clics = 0;
    clics += 1;
    await utilisateur.click(
      within(liste).getByRole('link', { name: /^Réviser le loyer d’Antoine/ }),
    );
    const revision = await carte(TEXTES_REVISION.titre);
    clics += 1;
    await utilisateur.click(
      within(revision).getByRole('button', { name: TEXTES_REVISION.appliquer }),
    );
    const statut = await within(revision).findByRole('status', {}, ATTENTE);
    expect(simple(statut.textContent)).toMatch(
      /^Révision appliquée : 404,61 € à partir d’octobre 2026\./,
    );
    expect(clics).toBe(2);
    expect(clients.gestion.donnees().locations[1]?.changements).toEqual([
      { aPartirDe: '2026-10', loyerHorsCharges: 40_461, charges: 3_000, apl: 0 },
    ]);
    const lien = within(statut).getByRole('link', { name: TEXTES_REVISION.voirLettre });
    expect(lien).toHaveAttribute(
      'href',
      '/gerer/lettres/lettre-1?retour=%2Fgerer%2Fbiens%2Fbien-baille',
    );

    await utilisateur.click(lien);
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_LETTRE.titre }, ATTENTE),
    ).toBeInTheDocument();
    expect(simple(screen.getByText(/^Calcul :/).textContent)).toBe(
      'Calcul : 400 € × 148,37 ÷ 146,68 = 404,61 €.',
    );
    expect(screen.getByRole('link', { name: /Studio Baille/ })).toHaveAttribute(
      'href',
      '/gerer/biens/bien-baille',
    );
  });

  it('lettre introuvable', async () => {
    monter('/gerer/lettres/inconnue', avec({}));
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_LETTRE.introuvable }, ATTENTE),
    ).toBeInTheDocument();
  });

  it('sans la migration 0008 : la fiche reste la même, la conformité dit « Bientôt disponible »', async () => {
    monter('/gerer/biens/bien-lices', { gestion: clientGestionMemoire({ etat: ETAT_SEPTEMBRE }) });
    const conformite = await carte(TEXTES_CONFORMITE.titre);
    expect(within(conformite).getByText(TEXTES_BAIL.indisponible)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: TEXTES_REVISION.titre })).toBeNull();
    expect(screen.getByRole('list', { name: 'Les 12 derniers mois' })).toBeInTheDocument();
  });
});
