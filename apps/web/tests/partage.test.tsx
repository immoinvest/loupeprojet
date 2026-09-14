import { projetExemple } from '@loupe/moteur';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { decoderPartage, encoderPartage, lienPartage, lireFragment } from '@/stockage/partage';
import { creerProjet, ecrireProjets, lireProjets, type ProjetEnregistre } from '@/stockage/projets';
import { AVERTISSEMENT_PARTAGE, RAISONS_PARTAGE } from '@/textes/partage';

const DATE = '2026-09-13T10:00:00.000Z';

/** Un projet qui remplit tous les champs optionnels : le pire cas pour la longueur du lien. */
function projetComplet(): ProjetEnregistre {
  return creerProjet({
    nom: 'T3 · 65 m² · Marseille 5e (complet)',
    statut: 'offre',
    genererId: () => 'complet',
    maintenant: () => DATE,
    source: {
      ...projetExemple,
      source: {
        portail: 'leboncoin',
        id: '2214738851',
        url: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      },
      marche: {
        ...projetExemple.marche,
        plafondLoyerMensuel: 1_100,
        risques: [
          { type: 'argiles', niveau: 'moyen' },
          { type: 'inondation', niveau: 'fort' },
        ],
      },
      hypotheses: {
        ...projetExemple.hypotheses,
        achat: { ...projetExemple.hypotheses.achat, travauxRenovationEnergetique: true },
        pret: { ...projetExemple.hypotheses.pret, differeTotalMois: 6, differePartielMois: 6 },
        location: {
          mode: 'courte_duree',
          loyerHc: 980,
          loyerHcNu: 850,
          chargesLocataire: 60,
          vacanceSemaines: 3,
          gestionTaux: 0.07,
          courteDuree: {
            nuitee: 85,
            tauxOccupation: 0.62,
            fraisMenageParNuit: 12,
            conciergerieTaux: 0.2,
            tourismeClasse: true,
          },
        },
      },
    },
  });
}

const base64url = (texte: string): string =>
  btoa(texte).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('encoderPartage / decoderPartage', () => {
  it('retrouve le projet enregistré à l’identique, y compris complet et avec des accents', () => {
    const simple = creerProjet({
      nom: 'Étude · n°1',
      genererId: () => 'a',
      maintenant: () => DATE,
    });
    for (const p of [simple, projetComplet()]) {
      const texte = encoderPartage(p);
      expect(texte).toMatch(/^[A-Za-z0-9_-]+$/);
      const retour = decoderPartage(texte);
      expect(retour.ok).toBe(true);
      if (retour.ok) expect(retour.enregistre).toEqual(p);
    }
  });

  it('produit un lien de quelques kilo-octets, bien sous les limites des navigateurs', () => {
    const lien = lienPartage('https://loupe.app', projetComplet());
    expect(lien.startsWith('https://loupe.app/partage#p=')).toBe(true);
    expect(lien.length).toBeGreaterThan(1_000);
    expect(lien.length).toBeLessThan(4_000);
  });

  it('refuse proprement un lien vide, abîmé, non JSON ou hors schéma', () => {
    expect(decoderPartage('')).toEqual({ ok: false, raison: 'vide' });
    expect(decoderPartage('   ')).toEqual({ ok: false, raison: 'vide' });
    expect(decoderPartage('%%%pas du base64')).toEqual({ ok: false, raison: 'illisible' });
    expect(decoderPartage(base64url('pas du json'))).toEqual({ ok: false, raison: 'illisible' });
    // Octets qui ne forment pas de l'UTF-8 valide.
    expect(decoderPartage('_w')).toEqual({ ok: false, raison: 'illisible' });
    expect(decoderPartage(base64url('{"id":"x"}'))).toEqual({ ok: false, raison: 'invalide' });
    const tronque = encoderPartage(projetComplet()).slice(0, 200);
    expect(decoderPartage(tronque).ok).toBe(false);
  });

  it('lit le fragment d’URL', () => {
    expect(lireFragment('#p=abc-_')).toBe('abc-_');
    expect(lireFragment('p=abc')).toBe('abc');
    expect(lireFragment('#autre=1')).toBeNull();
    expect(lireFragment('')).toBeNull();
  });

  it('a une phrase pour chaque raison de refus', () => {
    expect(Object.keys(RAISONS_PARTAGE)).toEqual(['vide', 'illisible', 'invalide']);
  });
});

describe('Page /partage', () => {
  it('montre le projet reçu en lecture seule et l’ajoute aux projets sur demande', async () => {
    const partage = creerProjet({
      nom: 'T2 · 40 m² · Lyon',
      statut: 'offre',
      genererId: () => 'emetteur',
      maintenant: () => DATE,
    });
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/partage#p=${encoderPartage(partage)}`} />);

    expect(await screen.findByText('Projet partagé')).toBeInTheDocument();
    expect(screen.getAllByText('T2 · 40 m² · Lyon').length).toBeGreaterThan(0);
    expect(screen.getByText(/Version du 13 sept\. 2026/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Combien d'impôts, selon le régime/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retenir ce régime' })).not.toBeInTheDocument();
    // Rien n'est enregistré avant le clic : seul le projet d'exemple amorcé est présent.
    expect(lireProjets(window.localStorage).map((p) => p.nom)).toEqual([
      'T3 · 65 m² · Marseille 5e',
    ]);

    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter à mes projets' }));
    const projets = lireProjets(window.localStorage);
    expect(projets).toHaveLength(2);
    expect(projets[0]?.nom).toBe('T2 · 40 m² · Lyon');
    expect(projets[0]?.id).not.toBe('emetteur');
    expect(projets[0]?.statut).toBe('analyse');
    expect(projets[0]?.projet.hypotheses.achat.prix).toBe(155_000);
    expect(
      await screen.findByRole('navigation', { name: 'Volets du rapport' }),
    ).toBeInTheDocument();
  });

  it('explique un lien vide, abîmé ou hors schéma sans rien enregistrer', async () => {
    render(<AppEnMemoire chemin="/partage" />);
    expect(
      await screen.findByRole('heading', { name: 'Lien de partage illisible' }),
    ).toBeInTheDocument();
    expect(screen.getByText(RAISONS_PARTAGE.vide)).toBeInTheDocument();

    render(<AppEnMemoire chemin="/partage#p=%%%" />);
    expect(await screen.findByText(RAISONS_PARTAGE.illisible)).toBeInTheDocument();

    render(<AppEnMemoire chemin={`/partage#p=${base64url('{"id":"x"}')}`} />);
    expect(await screen.findByText(RAISONS_PARTAGE.invalide)).toBeInTheDocument();
    expect(lireProjets(window.localStorage)).toHaveLength(1);
  });
});

describe('Bouton Partager', () => {
  function amorcer(): string {
    const p = creerProjet({
      nom: 'À partager',
      genererId: () => 'exemple',
      maintenant: () => DATE,
    });
    ecrireProjets(window.localStorage, [p]);
    return p.id;
  }

  it('copie le lien dans le presse-papiers et le dit', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });

    // L'infobulle prévient : le lien porte des données personnelles.
    expect(screen.getByRole('button', { name: 'Partager' })).toHaveAttribute(
      'title',
      AVERTISSEMENT_PARTAGE,
    );
    expect(AVERTISSEMENT_PARTAGE).toContain("apport et tranche d'imposition");
    await utilisateur.click(screen.getByRole('button', { name: 'Partager' }));
    expect(await screen.findByRole('button', { name: 'Lien copié' })).toBeInTheDocument();
    const lien = await navigator.clipboard.readText();
    expect(lien).toContain('/partage#p=');
    const retour = decoderPartage(lireFragment(new URL(lien).hash) ?? '');
    expect(retour.ok && retour.enregistre.nom).toBe('À partager');
  });

  it('montre le lien à copier à la main si le presse-papiers refuse', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('refusé'));
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });

    await utilisateur.click(screen.getByRole('button', { name: 'Partager' }));
    const champ = await screen.findByLabelText<HTMLInputElement>('Lien de partage');
    expect(champ.value).toContain('/partage#p=');
    expect(screen.getByRole('button', { name: 'Partager' })).toBeInTheDocument();
  });
});
