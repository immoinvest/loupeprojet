import { calculerProjet, projetExemple, questionsPourProjet } from '@loupe/moteur';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets, lireProjets, type Visite } from '@/stockage/projets';
import { CATEGORIES_VISITE, texteQuestion } from '@/textes/visite';

const r = calculerProjet(projetExemple);
const questions = questionsPourProjet(r.projet, r);
const N = questions.length;
const premiere = questions[0];
if (premiere === undefined) throw new Error('Le projet d’exemple doit poser des questions.');

/** Le projet d'exemple enregistré, avec ou sans visite. */
function amorcer(visite?: Visite): string {
  const p = creerProjet({
    nom: 'T3 · 65 m² · Marseille 5e',
    statut: 'visite',
    genererId: () => 'exemple',
    ...(visite === undefined ? {} : { visite }),
  });
  ecrireProjets(window.localStorage, [p]);
  return p.id;
}

const enregistre = (): ReturnType<typeof lireProjets>[number] | undefined =>
  lireProjets(window.localStorage)[0];

function volets(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Volets du rapport' });
}

describe('Écran Visite', () => {
  it('groupe les questions par catégorie, avec leur source, la progression et les feux', async () => {
    const id = amorcer();
    render(<AppEnMemoire chemin={`/projets/${id}/visite`} />);
    await screen.findByRole('heading', { level: 1, name: 'Préparer la visite' });

    for (const titre of Object.values(CATEGORIES_VISITE)) {
      expect(screen.getByRole('heading', { level: 2, name: titre })).toBeInTheDocument();
    }
    // Quatre réponses par question (les champs à valeur ont aussi leurs tuiles, comptées à part).
    const reponses = screen.getAllByRole('group', { name: /^Réponse : / });
    expect(reponses).toHaveLength(N);
    for (const groupe of reponses) expect(within(groupe).getAllByRole('radio')).toHaveLength(4);
    expect(screen.getAllByText(/^Source : /)).toHaveLength(N);
    expect(screen.getByText(`0 sur ${String(N)} répondues`)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Questions répondues' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.getByLabelText('Cinq feux')).toBeInTheDocument();
    // Les paramètres du moteur sont mis en forme dans les textes.
    const phrase = (motif: RegExp): HTMLElement => screen.getByText(motif, { selector: 'p' });
    expect(phrase(/immeuble de 1962/)).toBeInTheDocument();
    expect(phrase(/^3e étage sans ascenseur/)).toBeInTheDocument();
    expect(phrase(/Le prix est \d+ % sous les ventes comparables/)).toBeInTheDocument();
    expect(phrase(/Zone à risque \(argiles\)/)).toBeInTheDocument();
    expect(phrase(/honoraires d'agence \(7 000 €\)/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Marquer la visite comme faite' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'vos hypothèses' })).toBeInTheDocument();
  });

  // Deux rendus complets de l'écran (une cinquantaine de questions) : lent quand toute la suite tourne.
  it(
    'enregistre une réponse et une note avec le projet, et les retrouve au retour',
    { timeout: 60_000 },
    async () => {
      const id = amorcer();
      const utilisateur = userEvent.setup();
      render(<AppEnMemoire chemin={`/projets/${id}/visite`} />);
      await screen.findByRole('heading', { name: 'Préparer la visite' });
      const nom = `Réponse : ${texteQuestion(premiere)}`;

      await utilisateur.click(
        within(screen.getByRole('group', { name: nom })).getByRole('radio', { name: 'Problème' }),
      );
      expect(enregistre()?.visite?.reponses[premiere.id]).toEqual({ etat: 'probleme' });
      expect(screen.getByText(`1 sur ${String(N)} répondue, 1 problème`)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

      const boutonsNote = screen.getAllByRole('button', { name: 'Ajouter une note' });
      expect(boutonsNote).toHaveLength(N);
      await utilisateur.click(boutonsNote[0]!);
      const note = screen.getByRole('textbox', { name: `Note : ${texteQuestion(premiere)}` });
      // Collée d'un coup plutôt que tapée lettre à lettre : un seul enregistrement, espaces des bords compris.
      await utilisateur.click(note);
      await utilisateur.paste(' plan manquant ');
      expect(enregistre()?.visite?.reponses[premiere.id]).toEqual({
        etat: 'probleme',
        note: 'plan manquant',
      });

      await utilisateur.click(
        within(screen.getByRole('group', { name: nom })).getByRole('radio', { name: 'À vérifier' }),
      );
      expect(enregistre()?.visite?.reponses[premiere.id]).toEqual({
        etat: 'a_verifier',
        note: 'plan manquant',
      });
      expect(screen.getByText(`0 sur ${String(N)} répondues`)).toBeInTheDocument();

      cleanup();
      render(<AppEnMemoire chemin={`/projets/${id}/visite`} />);
      await screen.findByRole('heading', { name: 'Préparer la visite' });
      expect(
        within(screen.getByRole('group', { name: nom })).getByRole('radio', { name: 'À vérifier' }),
      ).toBeChecked();
      expect(
        screen.getByRole('textbox', { name: `Note : ${texteQuestion(premiere)}` }),
      ).toHaveValue('plan manquant');
      expect(screen.getAllByRole('button', { name: 'Ajouter une note' })).toHaveLength(N - 1);
    },
  );

  it('une question à valeur écrit l’hypothèse (provenance « à toi ») et passe la question à OK', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}/visite`} />);
    await screen.findByRole('heading', { name: 'Préparer la visite' });

    const charges = screen.getByLabelText(/^Copropriété \(part propriétaire\)/);
    expect((charges as HTMLInputElement).value.replace(/\s/g, ' ')).toBe('1 080');
    await utilisateur.clear(charges);
    await utilisateur.type(charges, '1450');
    expect(enregistre()?.projet.hypotheses.charges.coproAnnuel).toBe(1_450);
    expect(enregistre()?.projet.provenance['charges.coproAnnuel']).toBe('utilisateur');
    expect(enregistre()?.visite?.reponses.DOC_CHARGES_COPRO).toEqual({ etat: 'ok' });
    expect(screen.getByText(`1 sur ${String(N)} répondue`)).toBeInTheDocument();

    await utilisateur.clear(charges);
    // Un montant ne prend que des chiffres : les lettres sont ignorées.
    await utilisateur.type(charges, 'abc');
    expect(charges).toHaveValue('');
    expect(enregistre()?.projet.hypotheses.charges.coproAnnuel).toBe(0);

    // Corriger le DPE change la liste : G fait apparaître la rénovation obligatoire.
    expect(
      screen.queryByText(/location interdite à partir de/, { selector: 'p' }),
    ).not.toBeInTheDocument();
    await utilisateur.click(
      within(screen.getByRole('radiogroup', { name: /^DPE/ })).getByRole('radio', { name: 'G' }),
    );
    expect(enregistre()?.projet.bien.dpe).toBe('G');
    expect(
      screen.getByText(/DPE G : location interdite à partir de 2025/, { selector: 'p' }),
    ).toBeInTheDocument();
    expect(enregistre()?.visite?.reponses.LOG_DPE_COHERENCE).toEqual({ etat: 'ok' });
  });

  it('« Marquer la visite comme faite » retire l’onglet ; la page devient un compte rendu qui se rouvre', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}/visite`} />);
    await screen.findByRole('heading', { name: 'Préparer la visite' });
    expect(within(volets()).getByRole('link', { name: 'Visite' })).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: 'Marquer la visite comme faite' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Le prix est bon/ }),
    ).toBeInTheDocument();
    expect(enregistre()?.visite?.faite).toBe(true);
    expect(enregistre()?.visite?.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(within(volets()).queryByRole('link', { name: 'Visite' })).not.toBeInTheDocument();
    expect(within(volets()).getAllByRole('link')).toHaveLength(6);

    cleanup();
    render(<AppEnMemoire chemin={`/projets/${id}/visite`} />);
    await screen.findByRole('heading', { level: 1, name: 'Compte rendu de visite' });
    expect(screen.getByText(/Visite faite le \d+ \S+ 2026/)).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getAllByText('À vérifier')).toHaveLength(N);
    expect(
      screen.queryByRole('button', { name: 'Marquer la visite comme faite' }),
    ).not.toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: 'Rouvrir la visite' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Préparer la visite' }),
    ).toBeInTheDocument();
    expect(enregistre()?.visite).toEqual({ faite: false, reponses: {} });
    expect(within(volets()).getByRole('link', { name: 'Visite' })).toBeInTheDocument();
  });

  it('le compte rendu montre les états et les notes enregistrés', async () => {
    const id = amorcer({
      faite: true,
      date: '2026-09-14T10:00:00.000Z',
      reponses: {
        [premiere.id]: { etat: 'probleme', note: 'plan manquant' },
        DOC_TAXE_FONCIERE: { etat: 'ok' },
        ORPHELINE: { etat: 'probleme' },
      },
    });
    render(<AppEnMemoire chemin={`/projets/${id}/visite`} />);
    await screen.findByRole('heading', { level: 1, name: 'Compte rendu de visite' });
    expect(
      screen.getByText('Visite faite le 14 sept. 2026.', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(`2 sur ${String(N)} répondues, 1 problème`)).toBeInTheDocument();
    expect(screen.getByText('Problème')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('plan manquant')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('Rapport : carte « Avant de faire une offre »', () => {
  it('liste les points financiers et mène à la visite, puis au compte rendu', async () => {
    const id = amorcer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { level: 1, name: /Le prix est bon/ });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Avant de faire une offre' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Prélèvements sociaux du meublé à 18,6 % : taux à confirmer/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Demander les trois derniers PV/)).not.toBeInTheDocument();

    const lien = screen.getByRole('link', { name: `Préparer la visite : ${String(N)} questions` });
    await utilisateur.click(lien);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Préparer la visite' }),
    ).toBeInTheDocument();
    await utilisateur.click(screen.getAllByRole('radio', { name: 'Problème' })[0]!);
    await utilisateur.click(screen.getByRole('button', { name: 'Marquer la visite comme faite' }));
    await screen.findByRole('heading', { level: 1, name: /Le prix est bon/ });
    expect(
      screen.getByRole('link', { name: /Visite faite le .* · 1 problème/ }),
    ).toBeInTheDocument();
  });

  it('dit qu’il n’y a rien à régler quand le projet n’a aucun point financier', async () => {
    const p = creerProjet({
      nom: 'Nu',
      genererId: () => 'nu',
      source: {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          location: { mode: 'nu', loyerHc: 850 },
          fiscalite: { tmi: 0.3, regime: 'nu_reel' },
        },
      },
    });
    ecrireProjets(window.localStorage, [p]);
    render(<AppEnMemoire chemin={`/projets/${p.id}`} />);
    await screen.findByRole('heading', { level: 2, name: 'Avant de faire une offre' });
    expect(screen.getByText(/Rien à régler côté banque ni fiscalité/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Préparer la visite : \d+ questions/ }),
    ).toBeInTheDocument();
  });
});
