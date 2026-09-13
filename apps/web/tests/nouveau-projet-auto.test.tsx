import type { Capture } from '@loupe/capture';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { detecterExtension, lireParExtension } from '@/annonces/extension';
import { lireProjets } from '@/stockage/projets';

vi.mock('@/annonces/extension', () => ({
  detecterExtension: vi.fn(),
  lireParExtension: vi.fn(),
}));

const detecter = vi.mocked(detecterExtension);
const lire = vi.mocked(lireParExtension);

const URL_COLLEE =
  'https://www.seloger.com/annonce/achat/provence-alpes-cote-d-azur/bouches-du-rhone-13/marseille-13000/26FZC3J4KETZ?tracking=partage';
const URL_CANONIQUE =
  'https://www.seloger.com/annonce/achat/provence-alpes-cote-d-azur/bouches-du-rhone-13/marseille-13000/26FZC3J4KETZ';

const CAPTURE: Capture = {
  version: 1,
  portail: 'seloger',
  url: URL_CANONIQUE,
  id: '26FZC3J4KETZ',
  captureLe: '2026-09-13T10:41:00.000Z',
  typeBien: 'appartement',
  prix: 155_000,
  surface: 65,
  pieces: 3,
  chambres: 2,
  etage: 3,
  ascenseur: false,
  dpe: 'D',
  ges: 'B',
  codePostal: '13005',
  ville: 'Marseille 5e',
  lotsCopro: 24,
  coproEnProcedure: false,
  description:
    'Appartement T3 de 65 m². Charges de copropriété : 90 € / mois. Taxe foncière : 1 050 €.',
  mode: 'extension',
};

async function collerLeLien(): Promise<ReturnType<typeof userEvent.setup>> {
  const utilisateur = userEvent.setup();
  render(<AppEnMemoire chemin="/projets/nouveau" />);
  await screen.findByRole('heading', { name: /Colle le lien/ });
  await utilisateur.click(screen.getByLabelText("Lien de l'annonce"));
  await utilisateur.paste(URL_COLLEE);
  return utilisateur;
}

beforeEach(() => {
  detecter.mockReset();
  lire.mockReset();
});

describe('Nouveau projet — coller le lien suffit (extension installée)', () => {
  it(
    'lit l’annonce par l’extension, pré-remplit tout ce qu’elle dit, et crée le projet',
    { timeout: 30_000 },
    async () => {
      detecter.mockResolvedValue(true);
      let terminer: (valeur: { ok: true; capture: Capture }) => void = () => undefined;
      lire.mockImplementation(
        () =>
          new Promise((resoudre) => {
            terminer = resoudre;
          }),
      );
      const utilisateur = await collerLeLien();

      expect(
        await screen.findByText(/L'extension Deklic lit l'annonce/, {}, { timeout: 5_000 }),
      ).toBeInTheDocument();
      expect(lire).toHaveBeenCalledWith(window, URL_CANONIQUE);
      expect(screen.queryByPlaceholderText(/Appartement T3 de 65 m²/)).not.toBeInTheDocument();
      terminer({ ok: true, capture: CAPTURE });

      await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });
      expect(screen.getByText("lue par l'extension")).toBeInTheDocument();
      expect(screen.getByLabelText(/Prix affiché/)).toHaveValue('155000');
      expect(screen.getByLabelText(/Type de bien/)).toHaveValue('appartement');
      expect(screen.getByLabelText(/^GES/)).toHaveValue('B');
      expect(screen.getByLabelText(/Lots de copropriété/)).toHaveValue('24');
      expect(screen.getByLabelText(/Copropriété en procédure/)).toHaveValue('non');
      expect(screen.getByLabelText(/Charges de copropriété/)).toHaveValue('90');
      expect(screen.getByLabelText(/Taxe foncière/)).toHaveValue('1050');

      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '980');
      await utilisateur.type(screen.getByLabelText(/^Apport/), '15000');
      await utilisateur.type(screen.getByLabelText(/Vos revenus/), '2600');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));

      // Le rapport se calcule à l'ouverture : sous charge (suite complète), cela peut prendre plusieurs secondes.
      await screen.findByRole(
        'heading',
        { name: /Prix sans repère de marché/ },
        { timeout: 15_000 },
      );
      const cree = lireProjets(window.localStorage)[0];
      expect(cree?.projet.bien).toMatchObject({ ges: 'B', copro: { lots: 24, procedure: false } });
      expect(cree?.projet.source).toEqual({
        portail: 'seloger',
        id: '26FZC3J4KETZ',
        url: URL_CANONIQUE,
      });
      expect(cree?.projet.provenance['bien.ges']).toBe('annonce');
      expect(lire).toHaveBeenCalledTimes(1);
    },
  );

  it('explique un échec et permet de réessayer', { timeout: 30_000 }, async () => {
    detecter.mockResolvedValue(true);
    lire.mockResolvedValueOnce({ ok: false, raison: 'permission' });
    lire.mockResolvedValueOnce({ ok: true, capture: CAPTURE });
    const utilisateur = await collerLeLien();

    expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toHaveTextContent(
      /Autoriser la lecture automatique/,
    );
    expect(screen.getByPlaceholderText(/Appartement T3 de 65 m²/)).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Réessayer la lecture' }));
    await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });
    expect(screen.getByLabelText(/Surface/)).toHaveValue('65');
    expect(lire).toHaveBeenCalledTimes(2);
  });
});

describe('Nouveau projet — sans extension', () => {
  it('invite à installer l’extension et garde le texte collé', { timeout: 30_000 }, async () => {
    detecter.mockResolvedValue(false);
    await collerLeLien();
    expect(
      await screen.findByText(/coller le lien suffit : elle lit l'annonce pour vous/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Installer l'extension" })).toHaveAttribute(
      'href',
      '/extension',
    );
    expect(screen.getByPlaceholderText(/Appartement T3 de 65 m²/)).toBeInTheDocument();
    expect(lire).not.toHaveBeenCalled();
  });
});
