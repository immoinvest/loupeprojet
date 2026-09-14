import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { detecterExtension, lireParExtension } from '@/annonces/extension';
import { clientHorsLigne, type ClientWorker, type Resultat } from '@/enrichissement';
import type { PageLue } from '@/enrichissement/contrat';
import { lireProjets } from '@/stockage/projets';

vi.mock('@/annonces/extension', () => ({
  detecterExtension: vi.fn(),
  lireParExtension: vi.fn(),
}));

const detecter = vi.mocked(detecterExtension);
const lireExtension = vi.mocked(lireParExtension);

const URL_PAP = 'https://www.pap.fr/annonces/appartement-nice-06000-r463902045';

const PAGE_PAP = `<html><head><script type="application/ld+json">${JSON.stringify({
  '@type': 'Product',
  description: 'Studio T1 de 47 m² à Nice, proche de la mer.',
  image: ['https://img.exemple.fr/pap-1.jpg', 'https://img.exemple.fr/pap-2.jpg'],
  offers: { '@type': 'Offer', price: '249000', seller: { name: 'Particulier' } },
  additionalProperty: [
    { name: 'Surface', value: '47.00' },
    { name: 'Nombre de pièces', value: 1 },
    { name: 'Type de bien', value: 'Appartement' },
    { name: 'Ascenseur', value: 'Oui' },
    { name: 'Balcon / Terrasse', value: 'Oui' },
  ],
  address: { addressLocality: 'Nice', postalCode: '06000' },
})}</script></head><body></body></html>`;

const PAGE_LUE: Resultat<PageLue> = {
  ok: true,
  valeur: {
    portail: 'pap',
    url: URL_PAP,
    page: { type: 'html', html: PAGE_PAP },
    tentatives: 1,
    obtenuLe: '2026-09-14T12:00:00.000Z',
  },
};

function clientAvec(lirePage: ClientWorker['lirePage']): ClientWorker {
  return { ...clientHorsLigne, lirePage };
}

async function collerLeLien(client: ClientWorker): Promise<ReturnType<typeof userEvent.setup>> {
  const utilisateur = userEvent.setup();
  render(<AppEnMemoire chemin="/projets/nouveau" client={client} />);
  await screen.findByRole('heading', { name: /Colle le lien/ });
  await utilisateur.click(screen.getByLabelText("Lien de l'annonce"));
  await utilisateur.paste(URL_PAP);
  return utilisateur;
}

beforeEach(() => {
  detecter.mockReset();
  lireExtension.mockReset();
});

describe('Nouveau projet — Deklic lit l’annonce sans extension', () => {
  it(
    'attente, formulaire rempli, pastille « lue par Deklic », projet créé avec ses photos et sa fiche',
    { timeout: 30_000 },
    async () => {
      detecter.mockResolvedValue(false);
      let rendre: (r: Resultat<PageLue>) => void = () => undefined;
      const lirePage = vi.fn<ClientWorker['lirePage']>(
        () =>
          new Promise((resoudre) => {
            rendre = resoudre;
          }),
      );
      const utilisateur = await collerLeLien(clientAvec(lirePage));

      expect(
        await screen.findByText(/Deklic lit l'annonce PAP/, {}, { timeout: 5_000 }),
      ).toBeInTheDocument();
      expect(lirePage).toHaveBeenCalledWith(URL_PAP, expect.any(AbortSignal));
      expect(screen.queryByPlaceholderText(/Appartement T3 de 65 m²/)).not.toBeInTheDocument();
      rendre(PAGE_LUE);

      await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });
      expect(screen.getByText('lue par Deklic')).toBeInTheDocument();
      expect(screen.getByLabelText(/Prix affiché/)).toHaveValue('249000');
      expect(screen.getByLabelText(/Surface/)).toHaveValue('47');
      expect(lireExtension).not.toHaveBeenCalled();

      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '750');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));
      await screen.findByRole(
        'heading',
        { name: /Prix sans repère de marché/ },
        { timeout: 15_000 },
      );
      const cree = lireProjets(window.localStorage)[0];
      expect(cree?.annonce?.photos).toEqual([
        'https://img.exemple.fr/pap-1.jpg',
        'https://img.exemple.fr/pap-2.jpg',
      ]);
      expect(cree?.annonce?.fiche).toMatchObject({ balcon: true, vendeur: 'particulier' });
      expect(cree?.projet.bien.exterieur).toBe(true);
    },
  );

  it(
    '« Annuler et coller le texte » interrompt la lecture et propose le texte',
    { timeout: 30_000 },
    async () => {
      detecter.mockResolvedValue(false);
      let signalRecu: AbortSignal | undefined;
      const lirePage = vi.fn<ClientWorker['lirePage']>(
        (_, signal) =>
          new Promise((resoudre) => {
            signalRecu = signal;
            signal?.addEventListener('abort', () => {
              resoudre({ ok: false, code: 'RESEAU' });
            });
          }),
      );
      const utilisateur = await collerLeLien(clientAvec(lirePage));
      await utilisateur.click(
        await screen.findByRole(
          'button',
          { name: 'Annuler et coller le texte' },
          { timeout: 5_000 },
        ),
      );
      expect(signalRecu?.aborted).toBe(true);
      expect(await screen.findByRole('alert')).toHaveTextContent(/Lecture annulée/);
      expect(screen.getByPlaceholderText(/Appartement T3 de 65 m²/)).toBeInTheDocument();
    },
  );

  it(
    'page bloquée : l’explique, puis « Réessayer la lecture » réussit',
    { timeout: 30_000 },
    async () => {
      detecter.mockResolvedValue(false);
      const lirePage = vi
        .fn<ClientWorker['lirePage']>()
        .mockResolvedValueOnce({ ok: false, code: 'AMONT_VIDE' })
        .mockResolvedValueOnce(PAGE_LUE);
      const utilisateur = await collerLeLien(clientAvec(lirePage));
      expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toHaveTextContent(
        /n'a pas laissé lire l'annonce/,
      );
      await utilisateur.click(screen.getByRole('button', { name: 'Réessayer la lecture' }));
      await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });
      expect(lirePage).toHaveBeenCalledTimes(2);
    },
  );
});

describe('Nouveau projet — Deklic prend le relais de l’extension', () => {
  it(
    'l’extension n’ouvre pas l’annonce : la lecture par le serveur démarre d’elle-même',
    { timeout: 30_000 },
    async () => {
      detecter.mockResolvedValue(true);
      lireExtension.mockResolvedValue({ ok: false, raison: 'chargement' });
      const lirePage = vi.fn<ClientWorker['lirePage']>(() => Promise.resolve(PAGE_LUE));
      await collerLeLien(clientAvec(lirePage));
      await screen.findByRole('heading', { name: /Vérifiez, corrigez/ }, { timeout: 5_000 });
      expect(lireExtension).toHaveBeenCalledWith(window, URL_PAP);
      expect(lirePage).toHaveBeenCalledTimes(1);
      expect(screen.getByText('lue par Deklic')).toBeInTheDocument();
    },
  );

  it(
    'permission manquante : « Lire sans l’extension » lance la lecture par le serveur',
    { timeout: 30_000 },
    async () => {
      detecter.mockResolvedValue(true);
      lireExtension.mockResolvedValue({ ok: false, raison: 'permission' });
      const lirePage = vi.fn<ClientWorker['lirePage']>(() => Promise.resolve(PAGE_LUE));
      const utilisateur = await collerLeLien(clientAvec(lirePage));
      await utilisateur.click(
        await screen.findByRole('button', { name: "Lire sans l'extension" }, { timeout: 5_000 }),
      );
      await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });
      expect(lirePage).toHaveBeenCalledTimes(1);
    },
  );

  it(
    'serveur indisponible après un échec de l’extension : l’échec de l’extension reste affiché',
    { timeout: 30_000 },
    async () => {
      detecter.mockResolvedValue(true);
      lireExtension.mockResolvedValue({ ok: false, raison: 'vide' });
      await collerLeLien(clientHorsLigne);
      expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toHaveTextContent(
        /rien n'a pu y être lu/,
      );
    },
  );
});
