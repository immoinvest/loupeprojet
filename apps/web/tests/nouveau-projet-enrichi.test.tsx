import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientHorsLigne, type ClientWorker, type Resultat } from '@/enrichissement';
import { lireProjets } from '@/stockage/projets';

const ANNONCE = `Appartement T3 de 65 m² à Marseille 5e (13005), quartier Baille.
Au 3e étage sans ascenseur d'un immeuble construit en 1962. Prix : 155 000 €. DPE : D.`;

const ok = <T,>(valeur: T): Promise<Resultat<T>> => Promise.resolve({ ok: true, valeur });

/** Le Worker tel qu'il répond en production pour cette annonce (valeurs du 13/09/2026). */
const CLIENT: ClientWorker = {
  ...clientHorsLigne,
  extraire: () =>
    ok({
      prix: 155000,
      surface: 65,
      pieces: 3,
      chambres: 2,
      etage: 3,
      ascenseur: false,
      dpe: 'D',
      codePostal: '13005',
      ville: 'Marseille',
      annee: 1962,
      chargesCoproMois: 150,
      taxeFonciere: 980,
      honorairesAgence: null,
      meuble: null,
    }),
  geocoder: () =>
    ok({
      libelle: 'Marseille 5e Arrondissement',
      lat: 43.29,
      lon: 5.4,
      precision: 'commune',
      codeInsee: '13205',
      codePostal: '13005',
    }),
  marche: () =>
    ok({
      codeInsee: '13205',
      commune: 'Marseille 5e Arrondissement',
      dvf: { ventes: 1823, medianeM2: 3423, q1M2: 2833, q3M2: 4135 },
      loyer: { loyerM2: 15.03, basM2: 11.83, hautM2: 19.09, observations: 4655 },
      zone: 'A',
      sources: [],
    }),
};

describe('Nouveau projet — avec le Worker', () => {
  it(
    'lit l’annonce par l’IA, puis crée le projet avec les ventes réelles de l’arrondissement',
    { timeout: 30_000 },
    async () => {
      const utilisateur = userEvent.setup();
      render(<AppEnMemoire chemin="/projets/nouveau" client={CLIENT} />);
      await screen.findByRole('heading', { name: /Colle le lien/ });
      await utilisateur.type(
        screen.getByLabelText("Lien de l'annonce"),
        'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      );
      await utilisateur.click(screen.getByPlaceholderText(/Appartement T3 de 65 m²/));
      await utilisateur.paste(ANNONCE);
      await utilisateur.click(screen.getByRole('button', { name: 'Lire le texte' }));

      expect(await screen.findByText(/lus dans l'annonce par l'IA/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Ville/)).toHaveValue('Marseille');
      expect(screen.getByLabelText(/Charges de copropriété/)).toHaveValue('150');
      expect(screen.getByLabelText(/Taxe foncière/)).toHaveValue('980');

      await utilisateur.type(screen.getByLabelText(/Loyer visé/), '980');
      await utilisateur.type(screen.getByLabelText(/^Apport/), '15000');
      await utilisateur.type(screen.getByLabelText(/Vos revenus/), '2600');
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));

      // 155 000 € / 65 m² = 2 385 €/m², sous la médiane de 3 423 €/m² : le prix est bon.
      expect(
        await screen.findByRole('heading', { name: /Le prix est bon/ }, { timeout: 10_000 }),
      ).toBeInTheDocument();
      const projet = lireProjets(window.localStorage)[0]?.projet;
      expect(projet?.marche.dvf).toEqual({
        medianM2: 3423,
        q1M2: 2833,
        q3M2: 4135,
        nombreVentes: 1823,
        precision: 'commune',
        lieu: 'Marseille 5e Arrondissement',
      });
      expect(projet?.marche.loyerReferenceM2).toBe(13.83);
      expect(projet?.provenance['marche.dvf.medianM2']).toBe('dvf');
    },
  );
});
