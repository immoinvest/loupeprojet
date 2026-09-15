import type { EtatEnvois, EtatGestion } from '@loupe/gestion';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientMemoire } from '@/compte/memoire';
import type { Utilisateur } from '@/compte/types';
import { Accord } from '@/ecrans/accord/Accord';
import {
  clientAccordMemoire,
  clientEnvoisIndisponible,
  clientEnvoisMemoire,
  ETAT_ENVOIS_VIDE,
} from '@/gestion/envois/memoire';
import type { ClientAccord, ClientEnvois } from '@/gestion/envois/types';
import { clientGestionMemoire } from '@/gestion/memoire';
import { TEXTES_ACCORD, TEXTES_ENVOIS as T } from '@/textes/gerer-envois';

import { JETON } from './envois-exemples';
import { BAILLEUR, ETAT_SEPTEMBRE, HORODATAGE, PAIEMENT_JULIE } from './gestion-exemples';

const CAMILLE: Utilisateur = {
  id: 'u1',
  nom: 'Camille Roux',
  email: 'camille@example.org',
  image: null,
};

function envoisAvec(etat: Partial<EtatEnvois>): EtatEnvois {
  return { ...ETAT_ENVOIS_VIDE, ...etat };
}

function monter(
  chemin: string,
  options: {
    readonly gestion?: EtatGestion;
    readonly envois?: ClientEnvois;
    readonly accord?: ClientAccord;
    readonly connecte?: boolean;
  } = {},
): void {
  render(
    <AppEnMemoire
      chemin={chemin}
      compte={clientMemoire(options.connecte === false ? {} : { utilisateur: CAMILLE })}
      gestion={clientGestionMemoire({ etat: options.gestion ?? ETAT_SEPTEMBRE })}
      {...(options.envois === undefined ? {} : { envois: options.envois })}
      {...(options.accord === undefined ? {} : { accord: options.accord })}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

const ATTENTE = { timeout: 10_000 };

describe('page publique d’accord (G2-1)', () => {
  it('le locataire lit la proposition et accepte en un clic', async () => {
    const utilisateur = userEvent.setup();
    const accord = clientAccordMemoire({
      jetonsValides: [JETON],
      lecture: {
        prenom: 'Julie',
        bailleur: 'Pierre Georgel',
        logement: 'T2 Lices, 12 rue des Lices',
      },
    });
    monter(`/accord#${JETON}`, { accord, connecte: false });

    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_ACCORD.titre }, ATTENTE),
    ).toBeInTheDocument();
    expect(await screen.findByText('Bonjour Julie,', {}, ATTENTE)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pierre Georgel vous propose de recevoir vos quittances de loyer par e-mail pour le logement T2 Lices, 12 rue des Lices.',
      ),
    ).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_ACCORD.oui }));
    expect(await screen.findByRole('status')).toHaveTextContent(TEXTES_ACCORD.merciOui);
    expect(accord.reponses).toEqual([{ jeton: JETON, reponse: 'accorde' }]);
    expect(screen.queryByRole('button', { name: TEXTES_ACCORD.oui })).not.toBeInTheDocument();
  });

  it('« Non merci » ; lien absent, déjà utilisé ou service indisponible', async () => {
    const utilisateur = userEvent.setup();
    monter(`/accord#${JETON}`, {
      accord: clientAccordMemoire({ jetonsValides: [JETON] }),
      connecte: false,
    });
    await utilisateur.click(
      await screen.findByRole('button', { name: TEXTES_ACCORD.non }, ATTENTE),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(TEXTES_ACCORD.merciNon);
  });

  it('un lien mal formé ou déjà servi : « Ce lien n’est plus valable »', async () => {
    monter('/accord#abc', { connecte: false });
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_ACCORD.invalideTitre }, ATTENTE),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTES_ACCORD.invalide);
  });

  it('un jeton bien formé mais refusé par le serveur ; sans fournisseur, le service est indisponible', async () => {
    monter(`/accord#${JETON}`, { accord: clientAccordMemoire(), connecte: false });
    expect(
      await screen.findByRole('heading', { level: 1, name: TEXTES_ACCORD.invalideTitre }, ATTENTE),
    ).toBeInTheDocument();
  });

  it('hors fournisseur, la page dit que le service n’est pas disponible', async () => {
    render(
      <MemoryRouter initialEntries={[`/accord#${JETON}`]}>
        <Accord />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert', {}, ATTENTE)).toHaveTextContent(
      TEXTES_ACCORD.indisponible,
    );
  });
});

describe('fiche d’un locataire : quittances par e-mail', () => {
  it('accord en attente : « Mon locataire m’a déjà donné son accord » en un clic', async () => {
    const utilisateur = userEvent.setup();
    const envois = clientEnvoisMemoire({
      etat: envoisAvec({
        accords: [
          { locataireId: 'locataire-julie', statut: 'en_attente', invitationLe: HORODATAGE },
        ],
      }),
    });
    monter('/gerer/locataires/locataire-julie', { envois });

    const titre = await screen.findByRole('heading', { name: T.titreAccord }, ATTENTE);
    const carte = titre.closest('section') ?? document.body;
    expect(within(carte).getByText('En attente')).toBeInTheDocument();
    expect(within(carte).getByText('le 1er septembre 2026')).toBeInTheDocument();
    let clics = 0;
    clics += 1;
    await utilisateur.click(screen.getByRole('button', { name: T.declarer }));
    expect(await screen.findByRole('status')).toHaveTextContent(T.accordNote);
    expect(screen.getByText('Accord noté')).toBeInTheDocument();
    expect(clics).toBe(1);
    expect(envois.appels).toContain('declarerAccord');
    // Ouvrir la fiche suffit à retirer la ligne de « À faire » (une seule fois).
    expect(window.localStorage.getItem('deklic.gerer.accords-vus.v1')).toBe('["locataire-julie"]');
  });

  it('renvoyer la demande ; refus trop récent ; mode journal et envois inactifs', async () => {
    const utilisateur = userEvent.setup();
    const envois = clientEnvoisMemoire({
      etat: envoisAvec({
        mode: 'journal',
        accords: [{ locataireId: 'locataire-julie', statut: 'non_demande' }],
      }),
    });
    monter('/gerer/locataires/locataire-julie', { envois });
    expect(await screen.findByText(T.modeJournal, {}, ATTENTE)).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: T.renvoyerDemande }));
    expect(await screen.findByRole('status')).toHaveTextContent(T.demandeRenvoyee);
    await utilisateur.click(screen.getByRole('button', { name: T.renvoyerDemande }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une demande est déjà partie il y a moins de 24 heures.',
    );
  });

  it('sans invitations possibles, la carte le dit et ne propose que la déclaration', async () => {
    monter('/gerer/locataires/locataire-julie', {
      envois: clientEnvoisMemoire({
        etat: envoisAvec({
          invitations: false,
          accords: [{ locataireId: 'locataire-julie', statut: 'refuse', le: HORODATAGE }],
        }),
      }),
    });
    expect(await screen.findByText(T.inactifs, {}, ATTENTE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: T.renvoyerDemande })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: T.declarer })).toBeInTheDocument();
  });

  it('sans migration : « Bientôt disponible » dans la carte seulement, et pas de champ téléphone', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer/locataires/locataire-julie', { envois: clientEnvoisIndisponible() });
    expect(await screen.findByText(T.bientot, {}, ATTENTE)).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('form', { name: 'Modifier le locataire' })).toBeInTheDocument();
    expect(screen.queryByLabelText(T.telephone)).not.toBeInTheDocument();
  });

  it('téléphone : refusé s’il est invalide, enregistré et affiché sinon', async () => {
    const utilisateur = userEvent.setup();
    const envois = clientEnvoisMemoire({
      etat: envoisAvec({ accords: [{ locataireId: 'locataire-julie', statut: 'accorde' }] }),
    });
    monter('/gerer/locataires/locataire-julie?modifier=1', { envois });
    const champ = await screen.findByLabelText(T.telephone, {}, ATTENTE);
    await utilisateur.type(champ, '06 12');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(T.telephoneInvalide)).toBeInTheDocument();
    await utilisateur.clear(champ);
    await utilisateur.type(champ, '06 12 34 56 78');
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('link', { name: '06 12 34 56 78' }, ATTENTE)).toHaveAttribute(
      'href',
      'tel:0612345678',
    );
    expect(envois.donnees().contacts).toEqual([
      { locataireId: 'locataire-julie', telephone: '06 12 34 56 78' },
    ]);
  });
});

describe('loyers : trace d’envoi, « Renvoyer », « À faire »', () => {
  const GESTION_ENVOYEE: EtatGestion = {
    ...ETAT_SEPTEMBRE,
    bailleur: BAILLEUR,
    documents: [
      {
        id: 'document-julie',
        type: 'quittance',
        numero: 'Q-202609-LOCATION',
        locationId: 'location-julie',
        periode: '2026-09',
        emisLe: HORODATAGE,
      },
    ],
  };
  const ENVOI = {
    id: 'envoi-1',
    documentId: 'document-julie',
    locataireId: 'locataire-julie',
    destinataire: 'julie.martin@…',
    statut: 'envoye' as const,
    tentatives: 1,
    dernierEssaiLe: '2026-09-05T08:00:00.000Z',
    envoyeLe: '2026-09-05T08:00:00.000Z',
  };

  it('« Envoyée le 05/09 à julie.martin@… » et « Renvoyer » en un clic', async () => {
    const utilisateur = userEvent.setup();
    const envois = clientEnvoisMemoire({ etat: envoisAvec({ envois: [ENVOI] }) });
    monter('/gerer', { gestion: GESTION_ENVOYEE, envois });
    expect(
      await screen.findByText('Envoyée le 05/09 à julie.martin@…', {}, ATTENTE),
    ).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: T.renvoyer }));
    await waitFor(() => {
      expect(envois.appels).toContain('renvoyer');
    });
  });

  it('un renvoi refusé s’affiche ; un envoi en échec apparaît dans « À faire »', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer', {
      gestion: GESTION_ENVOYEE,
      envois: clientEnvoisMemoire({
        etat: envoisAvec({
          envois: [{ ...ENVOI, statut: 'echec', tentatives: 2 }],
          accords: [{ locataireId: 'locataire-julie', statut: 'accorde' }],
        }),
        erreurs: { renvoyer: 'envoi_recent' },
      }),
    });
    expect(
      await screen.findByText('Envoi à julie.martin@… en échec', {}, ATTENTE),
    ).toBeInTheDocument();
    const aFaire = screen.getByRole('list', { name: 'À faire' });
    expect(
      within(aFaire).getByRole('link', { name: /E-mail de Julie à vérifier/ }),
    ).toHaveAttribute('href', '/gerer/locataires/locataire-julie?modifier=1');
    await utilisateur.click(screen.getByRole('button', { name: T.renvoyer }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette quittance vient de partir. Réessaie dans une minute.',
    );
  });

  it('un accord en attente est signalé dans « À faire » tant que la fiche n’a pas été ouverte', async () => {
    const utilisateur = userEvent.setup();
    const envois = clientEnvoisMemoire({
      etat: envoisAvec({
        accords: [
          { locataireId: 'locataire-julie', statut: 'en_attente', invitationLe: HORODATAGE },
        ],
      }),
    });
    monter('/gerer', { envois });
    const aFaire = await screen.findByRole('list', { name: 'À faire' }, ATTENTE);
    const nom = /Accord de Julie Martin pour les quittances par e-mail/;
    await waitFor(() => {
      expect(within(aFaire).getByRole('link', { name: nom })).toBeInTheDocument();
    });
    await utilisateur.click(within(aFaire).getByRole('link', { name: nom }));
    expect(
      await screen.findByRole('heading', { name: T.titreAccord }, ATTENTE),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('deklic.gerer.accords-vus.v1')).toBe('["locataire-julie"]');
  });

  it('« Reçu » avec un accord valide : le message annonce la quittance par e-mail', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer', {
      gestion: {
        ...ETAT_SEPTEMBRE,
        paiements: ETAT_SEPTEMBRE.paiements.filter((p) => p.id !== PAIEMENT_JULIE.id),
      },
      envois: clientEnvoisMemoire({
        etat: envoisAvec({ accords: [{ locataireId: 'locataire-julie', statut: 'accorde' }] }),
      }),
    });
    await utilisateur.click(
      await screen.findByTitle('Marquer reçu le loyer de Julie', {}, ATTENTE),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      `Loyer de Julie reçu. ${T.quittancePartira}`,
    );
  });
});

describe('fiche d’un bien : bailleur de ce bien', () => {
  it('une SCI en deux clics, puis retour à l’identité du compte', async () => {
    const utilisateur = userEvent.setup();
    const envois = clientEnvoisMemoire();
    monter('/gerer/biens/bien-lices', {
      gestion: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR },
      envois,
    });
    expect(await screen.findByText(T.bailleurDuCompte, {}, ATTENTE)).toBeInTheDocument();

    let clics = 0;
    clics += 1;
    await utilisateur.click(screen.getByRole('button', { name: T.autreBailleur }));
    const formulaire = screen.getByRole('form', { name: T.formulaireBailleur });
    clics += 1;
    await utilisateur.click(within(formulaire).getByRole('button', { name: T.enregistrer }));
    expect(await screen.findByText(T.nomInvalide)).toBeInTheDocument();
    expect(screen.getByText(T.adresseInvalide)).toBeInTheDocument();

    await utilisateur.click(within(formulaire).getByRole('radio', { name: 'Une personne' }));
    await utilisateur.click(within(formulaire).getByRole('radio', { name: 'Une SCI' }));
    await utilisateur.type(within(formulaire).getByLabelText(T.nomBailleur), 'SCI Lices');
    await utilisateur.type(within(formulaire).getByLabelText(T.adresseBailleur), '1 cours Julien');
    await utilisateur.click(within(formulaire).getByRole('button', { name: T.enregistrer }));
    expect(await screen.findByText('SCI Lices')).toBeInTheDocument();
    expect(clics).toBe(2);
    expect(envois.donnees().bailleursBiens).toEqual([
      { bienId: 'bien-lices', type: 'sci', nom: 'SCI Lices', adresse: '1 cours Julien' },
    ]);

    await utilisateur.click(screen.getByRole('button', { name: T.modifierBailleur }));
    await utilisateur.click(screen.getByRole('button', { name: T.annuler }));
    await utilisateur.click(screen.getByRole('button', { name: T.revenirIdentite }));
    expect(await screen.findByText(T.bailleurDuCompte)).toBeInTheDocument();
  });

  it('sans identité connue ; un refus du serveur s’affiche', async () => {
    const utilisateur = userEvent.setup();
    monter('/gerer/biens/bien-lices', {
      envois: clientEnvoisMemoire({ erreurs: { enregistrerBailleurBien: 'invalide' } }),
    });
    expect(await screen.findByText(T.bailleurAucun, {}, ATTENTE)).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: T.autreBailleur }));
    await utilisateur.type(screen.getByLabelText(T.nomBailleur), 'SCI');
    await utilisateur.type(screen.getByLabelText(T.adresseBailleur), 'Marseille');
    await utilisateur.click(screen.getByRole('button', { name: T.enregistrer }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une information est incomplète ou invalide. Vérifie les champs.',
    );
  });
});
