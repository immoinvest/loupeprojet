import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { clientHorsLigne, type ClientWorker, type Resultat } from '@/enrichissement';
import { lireProjets } from '@/stockage/projets';

import { LUS, ouvrirGroupe } from './aides-verifier';

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
    'lit par l’IA une annonce partagée en texte, puis crée le projet avec les ventes réelles de l’arrondissement',
    { timeout: 30_000 },
    async () => {
      const utilisateur = userEvent.setup();
      render(
        <AppEnMemoire
          chemin={`/projets/nouveau?texte=${encodeURIComponent(ANNONCE)}`}
          client={CLIENT}
        />,
      );
      await screen.findByRole('heading', { name: /Vérifiez, corrigez/ });

      // « Marseille » et 150 € de charges : les valeurs du modèle, pas celles des règles.
      await ouvrirGroupe(utilisateur, LUS);
      expect(screen.getByRole('combobox', { name: 'Commune' })).toHaveValue('13005 Marseille');
      expect(screen.getByLabelText(/Charges de copropriété/)).toHaveValue('150');
      expect(screen.getByLabelText(/Taxe foncière/)).toHaveValue('980');

      // Ni loyer ni apport : le loyer vient des loyers de marché de la commune.
      await utilisateur.click(screen.getByRole('button', { name: /Créer le projet/ }));

      // 155 000 € / 65 m² = 2 385 €/m², sous la médiane de 3 423 €/m² : le prix est bon.
      expect(
        await screen.findByRole(
          'heading',
          { name: /Le prix est bon\. Le loyer/ },
          { timeout: 10_000 },
        ),
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
      // 13,83 €/m² × 65 m² × 1,15 (meublé) = 1 034 €, provenance « anil » ; taxe foncière lue dans l'annonce.
      expect(projet?.hypotheses.location).toMatchObject({ loyerHc: 1_034 });
      expect(projet?.provenance['location.loyerHc']).toBe('anil');
      expect(projet?.hypotheses.charges.taxeFonciere).toBe(980);
      // Sans apport saisi : 10 % du coût total, arrondi à la centaine.
      expect(projet?.hypotheses.pret.apport).toBeGreaterThan(15_500);
      expect((projet?.hypotheses.pret.apport ?? 1) % 100).toBe(0);
      expect(projet?.hypotheses.revenusMensuels).toBeUndefined();
    },
  );
});
