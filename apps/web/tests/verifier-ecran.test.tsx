import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ChampsExtraits, SaisieProjet } from '@/annonces';
import { ClientWorkerProvider } from '@/coque/ClientWorker';
import { FormulaireProjet, valeursDepuisChamps } from '@/ecrans/FormulaireProjet';
import { clientHorsLigne, type ClientWorker } from '@/enrichissement/client';

import { ESTIMES, LUS, PRECISER, ouvrirGroupe, radioDans, saisirCommune } from './aides-verifier';

type Utilisateur = ReturnType<typeof userEvent.setup>;

function monter(
  champs: ChampsExtraits = {},
  client: ClientWorker = clientHorsLigne,
): ReturnType<typeof vi.fn<(saisie: SaisieProjet) => void>> {
  const onCreer = vi.fn<(saisie: SaisieProjet) => void>();
  render(
    <ClientWorkerProvider client={client}>
      <FormulaireProjet initial={valeursDepuisChamps(champs)} annonce={null} onCreer={onCreer} />
    </ClientWorkerProvider>,
  );
  return onCreer;
}

async function remplirEssentiel(u: Utilisateur): Promise<void> {
  await u.type(screen.getByLabelText(/Prix affiché/), '120000');
  await u.type(screen.getByLabelText(/^Surface/), '40');
  await saisirCommune(u, '69003 Lyon');
}

const creer = (u: Utilisateur): Promise<void> =>
  u.click(screen.getByRole('button', { name: /Créer le projet/ }));

describe('Vérifier : le strict minimum d’abord', () => {
  it('à la main : l’essentiel en haut, deux résumés repliés, les plus influents en tête', () => {
    monter();
    const essentiel = screen.getByRole('heading', { name: "L'essentiel" }).parentElement!;
    for (const libelle of [/Prix affiché/, /^Surface/, /Loyer visé/]) {
      expect(within(essentiel).getByLabelText(libelle)).toBeInTheDocument();
    }
    expect(within(essentiel).getByRole('combobox', { name: 'Commune' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: LUS })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: ESTIMES })).toHaveAttribute('aria-expanded', 'false');
    const preciser = screen.getByRole('button', { name: PRECISER });
    expect(preciser).toHaveTextContent('DPE, état, charges de copro, taxe foncière…');
    expect(screen.queryByRole('radiogroup', { name: 'DPE' })).not.toBeInTheDocument();
  });

  it('annonce lue : seul le loyer reste en haut, le reste est résumé', async () => {
    const u = userEvent.setup();
    monter({
      prix: 150_000,
      surface: 50,
      codePostal: '69003',
      ville: 'Lyon',
      dpe: 'D',
      mode: 'nu',
    });
    const essentiel = screen.getByRole('heading', { name: "L'essentiel" }).parentElement!;
    expect(within(essentiel).queryByLabelText(/Prix affiché/)).not.toBeInTheDocument();
    expect(within(essentiel).getByLabelText(/Loyer visé/)).toBeInTheDocument();
    const lus = screen.getByRole('button', { name: LUS });
    expect(lus).toHaveTextContent('5 informations');
    await u.click(lus);
    expect(lus).toHaveTextContent('Replier');
    expect(radioDans('DPE', 'D')).toBeChecked();
    // L'icône ⓘ du DPE ouvre sa définition sans changer la lettre.
    await u.click(screen.getByRole('button', { name: 'Explication : DPE' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Diagnostic de performance énergétique/);
    expect(radioDans('DPE', 'D')).toBeChecked();
    await u.click(lus);
    expect(screen.queryByRole('radiogroup', { name: 'DPE' })).not.toBeInTheDocument();
  });
});

describe('Vérifier : moins de questions inutiles', () => {
  it('maison : ni étage, ni ascenseur, ni copropriété, et ces valeurs ne partent pas', async () => {
    const u = userEvent.setup();
    const onCreer = monter({ etage: 2, ascenseur: true, chargesCoproMois: 80, lotsCopro: 12 });
    await ouvrirGroupe(u, LUS);
    expect(screen.getByRole('radiogroup', { name: 'Ascenseur' })).toBeInTheDocument();
    expect(screen.getByLabelText('Étage')).toHaveValue('2');
    await ouvrirGroupe(u, PRECISER);
    await u.click(radioDans('Type de bien', 'Maison'));
    expect(screen.queryByRole('radiogroup', { name: 'Ascenseur' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Étage')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Charges de copropriété/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Lots de copropriété/)).not.toBeInTheDocument();

    await remplirEssentiel(u);
    await creer(u);
    const saisie = onCreer.mock.calls[0]?.[0];
    expect(saisie).toMatchObject({ typeBien: 'maison' });
    expect(saisie?.etage).toBeUndefined();
    expect(saisie?.ascenseur).toBeUndefined();
    expect(saisie?.chargesCoproMois).toBeUndefined();
    expect(saisie?.provenance).not.toHaveProperty('etage');
  });

  it('rez-de-chaussée : plus d’ascenseur à renseigner', async () => {
    const u = userEvent.setup();
    monter();
    await ouvrirGroupe(u, PRECISER);
    expect(screen.getByRole('radiogroup', { name: 'Ascenseur' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Un étage de plus' }));
    expect(screen.getByLabelText('Étage')).toHaveValue('0');
    expect(screen.getByText('RDC')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Ascenseur' })).not.toBeInTheDocument();
  });

  it('chambres déduites des pièces tant qu’on ne les règle pas', async () => {
    const u = userEvent.setup();
    const onCreer = monter();
    await ouvrirGroupe(u, PRECISER);
    const plusDePieces = screen.getByRole('button', { name: 'Une pièce de plus' });
    await u.click(plusDePieces);
    await u.click(plusDePieces);
    await u.click(plusDePieces);
    expect(screen.getByLabelText('Pièces')).toHaveValue('3');
    const chambres = screen.getByLabelText('Chambres');
    expect(chambres).toHaveValue('2');
    expect(chambres.closest('div.flex-col')).toHaveTextContent('estimé');

    await u.click(screen.getByRole('button', { name: 'Une chambre de plus' }));
    await u.click(screen.getByRole('button', { name: 'Une pièce de moins' }));
    expect(screen.getByLabelText('Pièces')).toHaveValue('2');
    expect(screen.getByLabelText('Chambres')).toHaveValue('3');

    await remplirEssentiel(u);
    await creer(u);
    expect(onCreer.mock.calls[0]?.[0]).toMatchObject({
      pieces: 2,
      chambres: 3,
      provenance: { pieces: 'utilisateur', chambres: 'utilisateur' },
    });
  });
});

describe('Vérifier : presque plus de chiffres à taper', () => {
  it('année par période (estimée) ou exacte', async () => {
    const u = userEvent.setup();
    const onCreer = monter();
    await remplirEssentiel(u);
    await ouvrirGroupe(u, PRECISER);
    await u.click(radioDans('Année de construction', '1949 à 1996'));
    await creer(u);
    expect(onCreer.mock.calls.at(-1)?.[0]).toMatchObject({
      // Milieu de 1949 à 1996, arrondi.
      annee: 1973,
      provenance: { annee: 'estime' },
    });

    await u.click(screen.getByRole('button', { name: "Je connais l'année" }));
    await u.type(screen.getByLabelText('Année exacte'), '1965');
    expect(radioDans('Année de construction', '1949 à 1996')).toBeChecked();
    await creer(u);
    expect(onCreer.mock.calls.at(-1)?.[0]).toMatchObject({
      annee: 1965,
      provenance: { annee: 'utilisateur' },
    });

    await u.click(screen.getByRole('button', { name: 'Je ne connais que la période' }));
    await u.click(radioDans('Année de construction', '1949 à 1996'));
    await creer(u);
    expect(onCreer.mock.calls.at(-1)?.[0].annee).toBeUndefined();
  });

  it('apport en parts du coût total : 20 % se calcule, 10 % revient au défaut estimé', async () => {
    const u = userEvent.setup();
    const onCreer = monter();
    await ouvrirGroupe(u, ESTIMES);
    expect(radioDans('Part du coût total', '20 %')).toBeDisabled();
    await remplirEssentiel(u);
    const defaut = Number(
      screen.getByLabelText<HTMLInputElement>(/^Apport/).value.replace(/\s/g, ''),
    );
    await u.click(radioDans('Part du coût total', '20 %'));
    expect(radioDans('Part du coût total', '20 %')).toBeChecked();
    const vingt = Number(
      screen.getByLabelText<HTMLInputElement>(/^Apport/).value.replace(/\s/g, ''),
    );
    expect(Math.abs(vingt - 2 * defaut)).toBeLessThanOrEqual(100);
    await creer(u);
    expect(onCreer.mock.calls.at(-1)?.[0]).toMatchObject({
      apport: vingt,
      provenance: { apport: 'utilisateur' },
    });

    await u.click(radioDans('Part du coût total', '10 %'));
    await creer(u);
    expect(onCreer.mock.calls.at(-1)?.[0].provenance.apport).toBe('estime');
    // « Autre » donne la main au montant.
    await u.click(radioDans('Part du coût total', 'Autre'));
    expect(screen.getByLabelText(/^Apport/)).toHaveFocus();
  });

  it('commune par le Worker : cinq chiffres suffisent', async () => {
    const u = userEvent.setup();
    const client: ClientWorker = {
      ...clientHorsLigne,
      communes: () =>
        Promise.resolve({
          ok: true,
          valeur: [{ nom: 'Marseille', codeInsee: '13055', codesPostaux: ['13005'] }],
        }),
    };
    const onCreer = monter({}, client);
    await u.type(screen.getByLabelText(/Prix affiché/), '155000');
    await u.type(screen.getByLabelText(/^Surface/), '65');
    await saisirCommune(u, '13005');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Commune' })).toHaveValue('13005 Marseille');
    });
    await creer(u);
    expect(onCreer.mock.calls[0]?.[0]).toMatchObject({ codePostal: '13005', ville: 'Marseille' });
  });

  it('état et GES en tuiles effaçables, lots au compteur à pas adaptatif', async () => {
    const u = userEvent.setup();
    const onCreer = monter({ lotsCopro: 20 });
    await remplirEssentiel(u);
    await ouvrirGroupe(u, PRECISER);
    await u.click(radioDans('État', 'Rénové'));
    await u.click(radioDans('GES', 'C'));
    await u.click(radioDans('GES', 'C'));
    await ouvrirGroupe(u, LUS);
    await u.click(screen.getByRole('button', { name: 'Plus de lots' }));
    await creer(u);
    const saisie = onCreer.mock.calls[0]?.[0];
    expect(saisie).toMatchObject({ etat: 'renove', lotsCopro: 30 });
    expect(saisie?.ges).toBeUndefined();
  });
});
