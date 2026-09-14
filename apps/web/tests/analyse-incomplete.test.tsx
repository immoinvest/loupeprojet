import { projetExemple, type ProjetEntree } from '@loupe/moteur';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { creerProjet, ecrireProjets, lireProjets } from '@/stockage/projets';

const n = (s: string | null | undefined): string => (s ?? '').replace(/\s/g, ' ');

/** Le projet d'exemple sans loyer visé, enregistré sous un identifiant connu. */
function amorcerSansLoyer(options: { sansMarche?: boolean } = {}): string {
  const location = Object.fromEntries(
    Object.entries(projetExemple.hypotheses.location).filter(([k]) => k !== 'loyerHc'),
  ) as ProjetEntree['hypotheses']['location'];
  const source: ProjetEntree = {
    ...projetExemple,
    ...(options.sansMarche === true ? { marche: {} } : {}),
    hypotheses: { ...projetExemple.hypotheses, location },
  };
  const p = creerProjet({ nom: 'T3 sans loyer', genererId: () => 'sans-loyer', source });
  ecrireProjets(window.localStorage, [p]);
  return p.id;
}

/** Le loyer mensuel enregistré du projet (meublé), absent tant qu'il n'est pas indiqué. */
function loyerEnregistre(): number | undefined {
  const location = lireProjets(window.localStorage)[0]?.projet.hypotheses.location;
  return location !== undefined && 'loyerHc' in location ? location.loyerHc : undefined;
}

describe('Rapport sans loyer', () => {
  it('dit ce qui manque, garde le prix, met les autres cartes « à compléter »', async () => {
    const id = amorcerSansLoyer();
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Le prix est bon. Le loyer reste à indiquer.',
      }),
    ).toBeInTheDocument();
    const feux = screen.getByLabelText('Cinq feux');
    expect(within(feux).getByText('Rendement net : loyer à indiquer')).toBeInTheDocument();
    expect(within(feux).getByText('Cash-flow : loyer à indiquer')).toBeInTheDocument();
    expect(within(feux).getByText('Crédit ÷ loyer : loyer à indiquer')).toBeInTheDocument();
    expect(within(feux).getByText('Risques : aucun')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Est-ce que c'est cher ?" })).toBeInTheDocument();
    expect(screen.getByText('Non.')).toBeInTheDocument();
    expect(screen.getAllByText('À compléter')).toHaveLength(4);
    expect(
      screen.getByRole('heading', { name: "Est-ce que ça s'autofinance ?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Combien d'impôts ?" })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: "Qu'est-ce qu'il vous restera ?" }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Levier 1 · Négocier')).not.toBeInTheDocument();
  });

  it('le champ du bandeau complète le projet ; le rapport se remplit', async () => {
    const id = amorcerSansLoyer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' });

    await utilisateur.type(screen.getByLabelText(/Loyer visé, hors charges/), '980');
    // Rien n'est enregistré avant « Appliquer » (ou Entrée) : le bandeau reste le temps de taper.
    expect(loyerEnregistre()).toBeUndefined();
    await utilisateur.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(loyerEnregistre()).toBe(980);
    expect(lireProjets(window.localStorage)[0]?.projet.provenance['location.loyerHc']).toBe(
      'utilisateur',
    );
    expect(
      screen.queryByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Le prix est bon. Le loyer ne couvre pas tout.',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Cinq feux')).getByText('Cash-flow −210 €/mois'),
    ).toBeInTheDocument();
    expect(screen.getByText('Levier 1 · Négocier')).toBeInTheDocument();
  });

  it('une saisie illisible est signalée sans rien enregistrer', async () => {
    const id = amorcerSansLoyer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' });
    await utilisateur.type(screen.getByLabelText(/Loyer visé, hors charges/), 'abc{Enter}');
    expect(screen.getByText('Nombre attendu.')).toBeInTheDocument();
    expect(loyerEnregistre()).toBeUndefined();
  });

  it('propose le loyer de marché de la commune quand le projet en a un', async () => {
    const id = amorcerSansLoyer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    await screen.findByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' });
    // 15,10 €/m² × 65 m² × 1,15 (meublé) = 1 129 €.
    const bouton = screen.getByRole('button', { name: /Utiliser le loyer de marché/ });
    expect(n(bouton.textContent)).toBe('Utiliser le loyer de marché : 1 129 €');
    await utilisateur.click(bouton);
    expect(loyerEnregistre()).toBe(1_129);
    expect(lireProjets(window.localStorage)[0]?.projet.provenance['location.loyerHc']).toBe('anil');
    expect(
      screen.queryByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' }),
    ).not.toBeInTheDocument();
  });

  it('sans ventes réelles ni loyer de marché : prix sans repère, pas de bouton', async () => {
    const id = amorcerSansLoyer({ sansMarche: true });
    render(<AppEnMemoire chemin={`/projets/${id}`} />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Prix sans repère de marché. Le loyer reste à indiquer.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Utiliser le loyer de marché/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('On ne sait pas.')).toBeInTheDocument();
  });
});

describe('autres volets sans loyer', () => {
  it('Fiscalité et Revente montrent le bandeau à la place des analyses', async () => {
    const id = amorcerSansLoyer();
    render(<AppEnMemoire chemin={`/projets/${id}/fiscalite`} />);
    await screen.findByRole('heading', { name: /Combien d'impôts, selon le régime/ });
    expect(
      screen.getByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retenir ce régime' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    render(<AppEnMemoire chemin={`/projets/${id}/revente`} />);
    await screen.findByRole('heading', { name: /Qu'est-ce qu'il vous restera/ });
    expect(screen.queryByRole('group', { name: 'Horizon de revente' })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' }),
    ).toHaveLength(2);
  });

  it('Hypothèses : synthèse en « — », loyer vide accepté, retiré si on l’efface', async () => {
    const id = amorcerSansLoyer();
    const utilisateur = userEvent.setup();
    render(<AppEnMemoire chemin={`/projets/${id}/hypotheses`} />);
    await screen.findByRole('heading', { name: 'Vos hypothèses' });
    const synthese = (libelle: string): HTMLElement =>
      screen.getByText(libelle, { exact: true }).parentElement!;
    expect(n(synthese('Cash-flow').textContent)).toBe('Cash-flow—');
    expect(n(synthese('Rendement net').textContent)).toBe('Rendement net—');
    expect(n(synthese('TRI').textContent)).toBe('TRI—');
    expect(n(synthese('Crédit ÷ loyer').textContent)).toBe('Crédit ÷ loyer—');

    const loyer = screen.getByLabelText(/Loyer visé, hors charges/);
    expect(loyer).toHaveValue('');
    await utilisateur.type(loyer, '980');
    expect(loyerEnregistre()).toBe(980);
    expect(n(synthese('Cash-flow').textContent)).toBe('Cash-flow−210 €/mois');

    await utilisateur.clear(loyer);
    expect(loyerEnregistre()).toBeUndefined();
    expect(screen.queryByText('Cette valeur est nécessaire au calcul.')).not.toBeInTheDocument();
    expect(n(synthese('Cash-flow').textContent)).toBe('Cash-flow—');
  });

  it('Visite : les feux disent ce qui manque, aucun point lié au loyer ou au régime', async () => {
    const id = amorcerSansLoyer();
    render(<AppEnMemoire chemin={`/projets/${id}/visite`} />);
    await screen.findByRole('heading', { name: 'Préparer la visite' });
    expect(screen.getByText('Cash-flow : loyer à indiquer')).toBeInTheDocument();
    expect(screen.queryByText(/Prélèvements sociaux/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Taux d'effort/)).not.toBeInTheDocument();
  });

  it('Financement : le crédit reste lisible, la couverture attend le loyer', async () => {
    const id = amorcerSansLoyer();
    render(<AppEnMemoire chemin={`/projets/${id}/financement`} />);
    const titre = await screen.findByRole('heading', { name: 'Le loyer porte-t-il le crédit ?' });
    const texte = n(titre.closest('section')?.textContent);
    expect(texte).toContain('Indiquez un loyer pour savoir si le crédit est couvert.');
    expect(texte).toContain('pas de loyer');
    expect(texte).toContain('Crédit et assurance');
    expect(texte).not.toContain('Loyer hors charges');
    expect(texte).not.toContain('Reste pour les charges et pour vous');
  });

  it('Mes projets : « — » pour ce qui attend le loyer, les feux inconnus en gris', async () => {
    amorcerSansLoyer();
    render(<AppEnMemoire chemin="/projets" />);
    await screen.findByRole('heading', { name: 'Mes projets' });
    const carte = within(screen.getByRole('main'))
      .getByRole('link', { name: 'T3 sans loyer' })
      .closest('section');
    expect(carte).not.toBeNull();
    const texte = n(carte?.textContent);
    expect(texte).toContain('Cash-flow—');
    expect(texte).toContain('Rendement net—');
    expect(texte).toContain('TRI 10 ans—');
    expect(texte).toContain('Prix vs marché−25 %');
  });

  it('Comparer : « — » sur les lignes qui attendent le loyer, régime et horizon lisibles', async () => {
    amorcerSansLoyer();
    const exemple = creerProjet({ nom: 'Exemple complet', genererId: () => 'complet' });
    ecrireProjets(window.localStorage, [...lireProjets(window.localStorage), exemple]);
    render(<AppEnMemoire chemin="/comparer" />);
    await screen.findByRole('heading', { name: 'Comparer' });
    const ligne = (libelle: string): HTMLElement =>
      within(screen.getByRole('table')).getByRole('row', { name: new RegExp(libelle) });
    expect(n(ligne('Cash-flow mensuel').textContent)).toContain('—');
    expect(n(ligne('Impôt du régime retenu').textContent)).toContain('Meublé au réel · 10 ans');
    expect(n(ligne('Horizon de revente').textContent)).toContain('10 ans');
  });

  it('Impression : la phrase du bandeau, sans champ ni bouton', async () => {
    const id = amorcerSansLoyer();
    render(<AppEnMemoire chemin={`/projets/${id}/imprimer`} />);
    expect(await screen.findByText(/dossier d'analyse locative/)).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { name: 'Il manque le loyer visé pour cette analyse' }).length,
    ).toBeGreaterThanOrEqual(3);
    expect(screen.queryByLabelText(/Loyer visé, hors charges/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Utiliser le loyer de marché/ }),
    ).not.toBeInTheDocument();
  });
});
