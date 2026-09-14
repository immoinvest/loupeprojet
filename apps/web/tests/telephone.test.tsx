import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { LONGUEUR_MAX_TEXTE_PARTAGE } from '@/annonces';
import { TEXTES_PARTAGE_RECU } from '@/textes/application';

const LEBONCOIN = 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851';

describe('Recevoir une annonce partagée', () => {
  it('le lien trouvé dans le texte pré-remplit Nouveau projet', async () => {
    const texte = encodeURIComponent(`Regarde cette annonce ${LEBONCOIN}`);
    render(<AppEnMemoire chemin={`/projets/nouveau?texte=${texte}`} />);
    await screen.findByRole('heading', { level: 1, name: /Colle le lien/ });

    expect(screen.getByLabelText("Lien de l'annonce")).toHaveValue(LEBONCOIN);
    expect(screen.getByText('leboncoin.fr reconnu')).toBeInTheDocument();
    expect(screen.getByText(TEXTES_PARTAGE_RECU.pastille)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Le texte de l'annonce" })).toBeInTheDocument();
  });

  it('un site non reconnu garde son lien, sans la pastille du partage', async () => {
    const texte = encodeURIComponent('Vu ici https://exemple.fr/annonce/42');
    render(<AppEnMemoire chemin={`/projets/nouveau?texte=${texte}`} />);
    await screen.findByRole('heading', { level: 1, name: /Colle le lien/ });

    expect(screen.getByLabelText("Lien de l'annonce")).toHaveValue('https://exemple.fr/annonce/42');
    expect(screen.getByText(/Site non reconnu/)).toBeInTheDocument();
    expect(screen.queryByText(TEXTES_PARTAGE_RECU.pastille)).toBeNull();
  });

  it('un texte partagé sans lien est prêt à être lu', async () => {
    const annonce = 'Appartement T3 de 65 m² au 3e étage, prix 155 000 €, DPE D';
    render(<AppEnMemoire chemin={`/projets/nouveau?texte=${encodeURIComponent(annonce)}`} />);
    await screen.findByRole('heading', { level: 1, name: /Colle le lien/ });

    expect(document.querySelector('textarea[name="texte"]')).toHaveValue(annonce);
    expect(screen.getByRole('button', { name: 'Lire le texte' })).toBeEnabled();
    expect(screen.queryByText(TEXTES_PARTAGE_RECU.pastille)).toBeNull();
  });

  it('un texte démesuré est tronqué à 10 000 caractères, et rien n’en est gardé', async () => {
    const demesure = `T3 lumineux ${'a'.repeat(20_000)}`;
    render(<AppEnMemoire chemin={`/projets/nouveau?texte=${encodeURIComponent(demesure)}`} />);
    await screen.findByRole('heading', { level: 1, name: /Colle le lien/ });

    expect(document.querySelector('textarea[name="texte"]')).toHaveValue(
      demesure.slice(0, LONGUEUR_MAX_TEXTE_PARTAGE),
    );
    const stocke = Array.from({ length: window.localStorage.length }, (_, i) =>
      window.localStorage.getItem(window.localStorage.key(i) ?? ''),
    ).join('');
    expect(stocke).not.toContain('aaaaaaaaaa');
  });

  it('une capture de l’extension dans l’adresse reste prioritaire', async () => {
    const lien = encodeURIComponent(LEBONCOIN);
    render(<AppEnMemoire chemin={`/projets/nouveau?lien=${lien}#capture=***`} />);
    await screen.findByRole('heading', { level: 1, name: /Colle le lien/ });

    expect(screen.getByText(/capture reçue est illisible/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lien de l'annonce")).toHaveValue('');
  });
});
