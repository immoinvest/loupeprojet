import { calculerProjet, projetExemple, questionsPourProjet } from '@loupe/moteur';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppEnMemoire } from '@/App';
import { liensDuProjet } from '@/stockage/liens-partage';
import {
  decoderPartage,
  decoderPartageCompresse,
  encoderPartage,
  lienPartage,
  lienPartageCompresse,
  lienPartageCourt,
  lireFragment,
  lireFragmentPartage,
} from '@/stockage/partage';
import {
  clientPartageIndisponible,
  clientPartageMemoire,
  type ClientPartage,
} from '@/stockage/partage-client';
import { usePartage } from '@/stockage/PartageContext';
import { creerProjet, ecrireProjets, lireProjets, type ProjetEnregistre } from '@/stockage/projets';
import {
  AVERTISSEMENT_PARTAGE,
  RAISONS_PARTAGE,
  RAISONS_PARTAGE_COURT,
  TEXTES_PARTAGE_PROJET,
} from '@/textes/partage';

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
          nuitee: 85,
          nuiteesParMois: 18.9,
          dureeSejourNuits: 3.5,
          menageFactureParSejour: 30,
          menageCoutParSejour: 45,
          plateformeTaux: 0.03,
          conciergerieTaux: 0.2,
          tourismeClasse: true,
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

  it('transporte la visite et ses réponses ; au pire (toutes répondues, notes longues) le lien reste court', () => {
    const complet = projetComplet();
    const r = calculerProjet(complet.projet);
    const questions = questionsPourProjet(r.projet, r);
    expect(questions.length).toBeGreaterThan(40);
    const etats = ['ok', 'probleme', 'sans_objet'] as const;
    const reponses = Object.fromEntries(
      questions.map((q, i) => [q.id, { etat: etats[i % 3] ?? 'ok', note: 'n'.repeat(120) }]),
    );
    const avecVisite: ProjetEnregistre = {
      ...complet,
      visite: { faite: true, date: DATE, reponses },
    };
    const retour = decoderPartage(encoderPartage(avecVisite));
    expect(retour.ok).toBe(true);
    if (retour.ok) expect(retour.enregistre).toEqual(avecVisite);
    const lien = lienPartage('https://loupe.app', avecVisite);
    expect(lien.length).toBeGreaterThan(4_000);
    expect(lien.length).toBeLessThan(20_000);
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
    expect(Object.keys(RAISONS_PARTAGE_COURT)).toEqual(['introuvable', 'indisponible']);
  });
});

describe('liens courts et compressés', () => {
  it('le lien court tient en une ligne', () => {
    expect(lienPartageCourt('https://app.deklic.pro', '7fK2qA9x')).toBe(
      'https://app.deklic.pro/p/7fK2qA9x',
    );
  });

  it('le lien compressé est environ deux fois plus court, sans la visite, et se relit', async () => {
    const complet = {
      ...projetComplet(),
      visite: { faite: false, reponses: { DOC_TITRE_PLAN: { etat: 'ok' as const } } },
    };
    const long = lienPartage('https://loupe.app', complet);
    const compresse = await lienPartageCompresse('https://loupe.app', complet);
    expect(compresse.startsWith('https://loupe.app/partage#z=')).toBe(true);
    expect(compresse.length).toBeLessThan(long.length * 0.6);
    const fragment = lireFragmentPartage(new URL(compresse).hash);
    expect(fragment?.format).toBe('compresse');
    const retour = await decoderPartageCompresse(fragment?.texte ?? '');
    expect(retour.ok).toBe(true);
    if (retour.ok) {
      expect(retour.enregistre).not.toHaveProperty('visite');
      expect(retour.enregistre.projet).toEqual(complet.projet);
    }
  });

  it('refuse un fragment compressé vide, abîmé ou hors schéma', async () => {
    expect(await decoderPartageCompresse(' ')).toEqual({ ok: false, raison: 'vide' });
    expect(await decoderPartageCompresse('%%%')).toEqual({ ok: false, raison: 'illisible' });
    const horsSchema = lireFragmentPartage(
      new URL(await lienPartageCompresse('https://x', projetComplet())).hash,
    );
    expect(horsSchema?.texte).toBeDefined();
    expect(lireFragmentPartage('#p=a&z=b')).toEqual({ format: 'complet', texte: 'a' });
    expect(lireFragmentPartage('#autre=1')).toBeNull();
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

  it('« Ajouter » reprend l’adresse et la visite du projet reçu', async () => {
    const adresse = {
      libelle: '10 rue Paradis, Marseille',
      lat: 43.29,
      lon: 5.38,
      codeInsee: '13206',
      codeVoie: '7100',
      numero: 10,
    };
    const visite = {
      faite: true,
      date: DATE,
      reponses: { DOC_TAXE_FONCIERE: { etat: 'ok' as const, note: 'vu' } },
    };
    const partage = creerProjet({
      nom: 'Avec visite',
      genererId: () => 'emetteur',
      maintenant: () => DATE,
      adresse,
      visite,
    });
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/partage#p=${encoderPartage(partage)}`} />);
    expect(await screen.findByText('Projet partagé')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Compte rendu de visite' }),
    ).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter à mes projets' }));
    const ajoute = lireProjets(window.localStorage)[0];
    expect(ajoute?.nom).toBe('Avec visite');
    expect(ajoute?.adresse).toEqual(adresse);
    expect(ajoute?.visite).toEqual(visite);
    // Visite faite : pas d'onglet Visite dans le projet ajouté.
    const volets = await screen.findByRole('navigation', { name: 'Volets du rapport' });
    expect(within(volets).queryByRole('link', { name: 'Visite' })).not.toBeInTheDocument();
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

  it('ouvre un lien compressé #z= ; abîmé, il est expliqué', async () => {
    const partage = creerProjet({ nom: 'Compressé', genererId: () => 'z', maintenant: () => DATE });
    const lien = await lienPartageCompresse('http://localhost', partage);
    render(<AppEnMemoire chemin={`/partage${new URL(lien).hash}`} />);
    expect(await screen.findByText('Projet partagé')).toBeInTheDocument();
    expect(screen.getAllByText('Compressé').length).toBeGreaterThan(0);

    render(<AppEnMemoire chemin="/partage#z=%%%" />);
    expect(await screen.findByText(RAISONS_PARTAGE.illisible)).toBeInTheDocument();
  });
});

describe('Page /p/:id', () => {
  it('lit le lien court et propose d’ajouter le projet', async () => {
    const client = clientPartageMemoire({ genererId: () => '7fK2qA9x' });
    await client.creer(creerProjet({ nom: 'Court', genererId: () => 'e', maintenant: () => DATE }));
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin="/p/7fK2qA9x" partage={client} />);
    expect(screen.getByText(TEXTES_PARTAGE_PROJET.chargement)).toBeInTheDocument();
    expect(await screen.findByText('Projet partagé')).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter à mes projets' }));
    expect(lireProjets(window.localStorage)[0]?.nom).toBe('Court');
  });

  it('lien expiré ou arrêté, puis API injoignable : chacun sa phrase', async () => {
    render(<AppEnMemoire chemin="/p/ZZZZZZZZ" />);
    expect(await screen.findByText(RAISONS_PARTAGE_COURT.introuvable)).toBeInTheDocument();
    cleanup();
    render(<AppEnMemoire chemin="/p/ZZZZZZZZ" partage={clientPartageIndisponible} />);
    expect(await screen.findByText(RAISONS_PARTAGE_COURT.indisponible)).toBeInTheDocument();
  });

  it('usePartage exige son fournisseur', () => {
    function SansFournisseur(): null {
      usePartage();
      return null;
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<SansFournisseur />)).toThrow(/PartageProvider/);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
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

  it('crée un lien court, le copie, et redonne le même tant que le projet ne change pas', async () => {
    const id = amorcer();
    const client = clientPartageMemoire({ genererId: () => '7fK2qA9x' });
    const creer = vi.spyOn(client, 'creer');
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} partage={client} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });

    // L'infobulle prévient : le lien donne des données personnelles.
    const bouton = screen.getByRole('button', { name: 'Partager' });
    expect(bouton).toHaveAttribute('title', AVERTISSEMENT_PARTAGE);
    expect(AVERTISSEMENT_PARTAGE).toContain("apport et tranche d'imposition");
    await utilisateur.click(bouton);
    expect(await screen.findByRole('button', { name: 'Lien copié' })).toBeInTheDocument();
    const lien = await navigator.clipboard.readText();
    expect(new URL(lien).pathname).toBe('/p/7fK2qA9x');
    expect(screen.getByText(TEXTES_PARTAGE_PROJET.avertissement)).toBeInTheDocument();
    const lu = await client.lire('7fK2qA9x');
    expect(lu.ok && lu.valeur.projet.nom).toBe('À partager');
    expect(liensDuProjet(window.localStorage, id)).toHaveLength(1);

    await utilisateur.click(screen.getByRole('button', { name: 'Fermer' }));
    await utilisateur.click(bouton);
    expect(await screen.findByRole('button', { name: 'Lien copié' })).toBeInTheDocument();
    expect(creer).toHaveBeenCalledOnce();
  });

  it('sans lien court possible, donne le lien long compressé et le dit', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} partage={clientPartageIndisponible} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });
    await utilisateur.click(screen.getByRole('button', { name: 'Partager' }));
    expect(await screen.findByText(TEXTES_PARTAGE_PROJET.avertissementLong)).toBeInTheDocument();
    const lien = await navigator.clipboard.readText();
    const retour = await decoderPartageCompresse(
      lireFragmentPartage(new URL(lien).hash)?.texte ?? '',
    );
    expect(retour.ok && retour.enregistre.nom).toBe('À partager');
    expect(screen.queryByRole('button', { name: TEXTES_PARTAGE_PROJET.arreter })).toBeNull();
    // Le décodeur complet refuse ce format : les deux restent distincts.
    expect(decoderPartage(lireFragment(new URL(lien).hash) ?? '').ok).toBe(false);
  });

  it('hors ligne, n’appelle pas l’API', async () => {
    const id = amorcer();
    const creer = vi.fn();
    const client: ClientPartage = { ...clientPartageMemoire(), creer };
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} partage={client} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });
    await utilisateur.click(screen.getByRole('button', { name: 'Partager' }));
    expect(await screen.findByText(TEXTES_PARTAGE_PROJET.avertissementLong)).toBeInTheDocument();
    expect(creer).not.toHaveBeenCalled();
  });

  it('« Arrêter le partage » éteint le lien ; un échec est dit et le lien reste à arrêter', async () => {
    const id = amorcer();
    const client = clientPartageMemoire({ genererId: () => 'AAAAAAAA' });
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} partage={client} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });
    await utilisateur.click(screen.getByRole('button', { name: 'Partager' }));
    await screen.findByRole('button', { name: 'Lien copié' });

    const supprimer = vi
      .spyOn(client, 'supprimer')
      .mockResolvedValueOnce({ ok: false, code: 'reseau' });
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PARTAGE_PROJET.arreter }));
    expect(await screen.findByText(TEXTES_PARTAGE_PROJET.arretImpossible)).toBeInTheDocument();
    expect(liensDuProjet(window.localStorage, id)).toHaveLength(1);

    supprimer.mockRestore();
    await utilisateur.click(screen.getByRole('button', { name: TEXTES_PARTAGE_PROJET.arreter }));
    expect(await screen.findByText(TEXTES_PARTAGE_PROJET.arrete)).toBeInTheDocument();
    expect(await client.lire('AAAAAAAA')).toEqual({ ok: false, code: 'introuvable' });
    expect(liensDuProjet(window.localStorage, id)).toEqual([]);
    expect(screen.queryByRole('button', { name: TEXTES_PARTAGE_PROJET.arreter })).toBeNull();
  });

  it('montre le lien à copier à la main si le presse-papiers refuse', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('refusé'));
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });

    await utilisateur.click(screen.getByRole('button', { name: 'Partager' }));
    expect(await screen.findByRole('status')).toHaveTextContent(TEXTES_PARTAGE_PROJET.copieRefusee);
    const champ = screen.getByLabelText<HTMLInputElement>('Lien de partage');
    expect(champ.value).toContain('/p/');
    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeInTheDocument();
  });

  it('la boîte se referme par Échap, rend le focus au bouton, et par le bouton Fermer', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: /Le prix est bon/ });
    const bouton = screen.getByRole('button', { name: 'Partager' });

    await utilisateur.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Lien de partage')).toHaveFocus();
    await utilisateur.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bouton).toHaveFocus();

    await utilisateur.click(bouton);
    await utilisateur.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
