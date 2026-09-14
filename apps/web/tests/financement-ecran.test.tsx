import { calculerProjet, projetExemple, type ProjetEntree } from '@loupe/moteur';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { decoderSimulation, lireFragmentSimulation } from '@/analyses';
import { AppEnMemoire } from '@/App';
import { euros } from '@/formatage/nombres';
import { creerProjet, ecrireProjets, lireProjets } from '@/stockage/projets';

const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

const TITRE = "Comment se finance l'achat ?";

function carte(titre: string): HTMLElement {
  const section = screen.getByRole('heading', { name: titre }).closest('section');
  if (section === null) throw new Error(`carte introuvable : ${titre}`);
  return section;
}

/** Enregistre une variante du projet d'exemple sous un identifiant connu. */
function amorcer(id: string, hypotheses: Partial<ProjetEntree['hypotheses']>): void {
  const source: ProjetEntree = {
    ...projetExemple,
    hypotheses: { ...projetExemple.hypotheses, ...hypotheses },
  };
  ecrireProjets(window.localStorage, [creerProjet({ nom: id, genererId: () => id, source })]);
}

async function ouvrirFinancement(): Promise<string> {
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { name: 'Mes projets' });
  const id = lireProjets(window.localStorage)[0]?.id ?? '';
  render(<AppEnMemoire chemin={`/projets/${id}/financement`} />);
  await screen.findByRole('heading', { name: TITRE });
  return id;
}

describe('Financement', () => {
  it('montre le prêt, ce qu’il coûte, d’où vient l’argent, la couverture et le tableau par année', async () => {
    await ouvrirFinancement();
    const r = calculerProjet(projetExemple);

    // Les hypothèses du prêt, éditables, avec leurs badges.
    expect(screen.getByLabelText(/Durée du prêt/)).toHaveValue('25');
    expect(screen.getByLabelText(/Taux nominal/)).toHaveValue('3.35');
    expect(screen.getByLabelText(/^Apport/)).toHaveValue('14337');
    expect(within(carte('Votre prêt')).getByText('taux du mois')).toBeInTheDocument();

    const cout = n(carte('Ce que ça coûte').textContent);
    expect(cout).toContain(euros(r.financement.mensualiteTotale).replace(/\s/g, ' '));
    expect(cout).toContain('161 00');
    expect(cout).toContain('TAEG assurance comprise');
    expect(cout).not.toContain("au-dessus du taux d'usure");

    const origine = n(carte("D'où vient l'argent").textContent);
    expect(origine).toContain('155 000 €');
    expect(origine).toContain('Mobilier, payé comptant');
    expect(origine).toContain('La banque prête');

    const couverture = n(carte('Le loyer porte-t-il le crédit ?').textContent);
    expect(couverture).toContain('84 %');
    expect(couverture).toContain('Le loyer couvre la mensualité');
    expect(couverture).not.toContain('Effort bancaire');

    // 25 années plus l'en-tête ; pas de différé, donc pas de liste de phases.
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(26);
    expect(screen.queryByText(/Différé total, rien à payer/)).not.toBeInTheDocument();

    // Le bouton mène au simulateur avec le prêt dans le fragment.
    const lien = screen.getByRole('link', { name: 'Simuler un prêt' });
    const href = lien.getAttribute('href') ?? '';
    expect(href.startsWith('/simulateur-pret#s=')).toBe(true);
    const decodage = decoderSimulation(lireFragmentSimulation(href.slice(href.indexOf('#'))) ?? '');
    expect(decodage.ok && decodage.simulation.offres[0]?.dureeAnnees).toBe(25);
    expect(decodage.ok && decodage.simulation.projet.fraisNotaire).toBeCloseTo(
      r.financement.fraisAcquisition.total,
      2,
    );
  });

  it('changer la durée recalcule la mensualité et l’enregistre ; une valeur invalide est refusée', async () => {
    await ouvrirFinancement();
    const utilisateur = userEvent.setup();

    const duree = screen.getByLabelText(/Durée du prêt/);
    await utilisateur.clear(duree);
    await utilisateur.type(duree, '20');
    const enregistre = lireProjets(window.localStorage)[0]?.projet;
    expect(enregistre?.hypotheses.pret.dureeAnnees).toBe(20);
    expect(enregistre?.provenance['pret.dureeAnnees']).toBe('utilisateur');
    const attendu = calculerProjet({
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        pret: { ...projetExemple.hypotheses.pret, dureeAnnees: 20 },
      },
    }).financement.mensualiteTotale;
    expect(n(carte('Ce que ça coûte').textContent)).toContain(euros(attendu).replace(/\s/g, ' '));

    const taux = screen.getByLabelText(/Taux nominal/);
    await utilisateur.clear(taux);
    await utilisateur.type(taux, 'abc');
    expect(screen.getByText('Pourcentage attendu, par exemple 3,35.')).toBeInTheDocument();
    expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.pret.tauxNominal).toBe(0.0335);

    // « 4 » puis « 40 » sont valides et enregistrés ; « 400 » dépasse la durée du prêt et
    // est refusé : la dernière valeur valide (40) reste en vigueur, les phases apparaissent.
    const differe = screen.getByLabelText(/Différé total/);
    await utilisateur.clear(differe);
    await utilisateur.type(differe, '400');
    expect(screen.getByText(/différé doit être plus court/)).toBeInTheDocument();
    expect(lireProjets(window.localStorage)[0]?.projet.hypotheses.pret.differeTotalMois).toBe(40);
    expect(screen.getByText(/Différé total, rien à payer · mois 1 à 40/)).toBeInTheDocument();
  });

  it('un projet ancien avec des revenus montre l’effort bancaire ; durée et usure sont signalées', async () => {
    amorcer('ancien', {
      revenusMensuels: 1_200,
      pret: {
        ...projetExemple.hypotheses.pret,
        dureeAnnees: 27,
        tauxNominal: 0.06,
        tauxAssurance: 0.01,
      },
    });
    render(<AppEnMemoire chemin="/projets/ancien/financement" />);
    await screen.findByRole('heading', { name: TITRE });
    const couverture = n(carte('Le loyer porte-t-il le crédit ?').textContent);
    expect(couverture).toContain('Effort bancaire (revenus indiqués à la création)');
    expect(couverture).toContain('au-dessus de 35 %');
    expect(couverture).toContain('plus long que le maximum bancaire de 25 ans');
    expect(n(carte('Ce que ça coûte').textContent)).toContain("au-dessus du taux d'usure");
  });

  it('sans emprunt, rien à rembourser et la couverture est bonne', async () => {
    amorcer('comptant', { pret: { ...projetExemple.hypotheses.pret, apport: 400_000 } });
    render(<AppEnMemoire chemin="/projets/comptant/financement" />);
    await screen.findByRole('heading', { name: TITRE });
    expect(screen.getAllByText(/Pas d'emprunt/)).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(n(carte('Le loyer porte-t-il le crédit ?').textContent)).toContain('0 %');
  });

  it('la page du simulateur annonce l’outil en attendant la fiche 08', async () => {
    render(<AppEnMemoire chemin="/simulateur-pret#s=abc" />);
    expect(await screen.findByRole('heading', { name: 'Simulateur de prêt' })).toBeInTheDocument();
    expect(screen.getByText(/déjà dans le lien/)).toBeInTheDocument();
  });
});
