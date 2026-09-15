import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { AppEnMemoire } from '@/App';
import { enPixels, hauteurCollee, lireDecalage } from '@/coque/entete';

/** Nom du projet créé au premier lancement (voir `ProjetsProvider`). */
const NOM_EXEMPLE = 'T3 · 65 m² · Marseille 5e';

function contenu(): HTMLElement {
  const element = document.querySelector('main');
  if (element === null) throw new Error('contenu principal absent');
  return element;
}

function barreLaterale(): HTMLElement {
  const element = document.getElementById('navigation-principale');
  if (element === null) throw new Error('navigation principale absente');
  return element;
}

function cadreProjet(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-cadre-projet]');
  if (element === null) throw new Error('cadre du projet absent');
  return element;
}

function enTete(): HTMLElement {
  const element = cadreProjet().querySelector('header');
  if (element === null) throw new Error('en-tête du projet absent');
  return element;
}

async function ouvrirMesProjets(): Promise<ReturnType<typeof userEvent.setup>> {
  const utilisateur = userEvent.setup();
  render(<AppEnMemoire chemin="/projets" />);
  await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
  return utilisateur;
}

async function ouvrirExemple(): Promise<ReturnType<typeof userEvent.setup>> {
  const utilisateur = await ouvrirMesProjets();
  await utilisateur.click(within(contenu()).getByRole('link', { name: NOM_EXEMPLE }));
  await screen.findByRole('heading', { level: 1, name: /Le prix est bon\./ });
  return utilisateur;
}

/** Un `ResizeObserver` de test : il retient l'élément observé et laisse déclencher la mesure. */
class ObservateurDeTest {
  static instances: ObservateurDeTest[] = [];
  observes: Element[] = [];
  deconnecte = false;
  constructor(readonly rappel: () => void) {
    ObservateurDeTest.instances.push(this);
  }
  observe(element: Element): void {
    this.observes.push(element);
  }
  disconnect(): void {
    this.deconnecte = true;
  }
}

function simulerResizeObserver(): void {
  ObservateurDeTest.instances = [];
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ObservateurDeTest,
  });
}

afterEach(() => {
  Reflect.deleteProperty(window, 'ResizeObserver');
});

describe('Coque fixe : seul le contenu défile', () => {
  it('la coque tient dans la fenêtre et le contenu est le seul conteneur qui défile', async () => {
    await ouvrirMesProjets();
    const racine = contenu().parentElement;
    expect(racine).not.toBeNull();
    expect(racine).toHaveClass('h-dvh', 'overflow-hidden');
    expect(contenu()).toHaveClass('overflow-y-auto', 'min-h-0');
    // À l'impression, la page redevient un document d'une seule pièce.
    expect(racine).toHaveClass('print:h-auto', 'print:overflow-visible');
    expect(contenu()).toHaveClass('print:overflow-visible');
  });

  it('changer de volet remet le contenu en haut', async () => {
    const utilisateur = await ouvrirExemple();

    contenu().scrollTop = 480;
    const volets = screen.getByRole('navigation', { name: 'Volets du rapport' });
    await utilisateur.click(within(volets).getByRole('link', { name: 'Hypothèses' }));
    await screen.findByRole('heading', { level: 1, name: 'Vos hypothèses' });
    expect(contenu().scrollTop).toBe(0);

    // Une navigation vers le chemin déjà affiché (même volet) ne bouge pas le contenu.
    contenu().scrollTop = 120;
    await utilisateur.click(within(volets).getByRole('link', { name: 'Hypothèses' }));
    expect(contenu().scrollTop).toBe(120);
  });

  it('le menu : les sections Analyser et Gérer défilent dans leur zone, le logo, les outils et le profil restent en dehors', async () => {
    await ouvrirMesProjets();
    const barre = barreLaterale();
    expect(barre).toHaveClass('overflow-hidden');
    const zone = barre.querySelector<HTMLElement>('[data-zone="defilante"]');
    expect(zone).not.toBeNull();
    expect(zone).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1');

    const analyser = within(barre).getByRole('navigation', { name: 'Analyser' });
    const gerer = within(barre).getByRole('navigation', { name: 'Gérer' });
    expect(zone).toContainElement(analyser);
    expect(zone).toContainElement(gerer);
    // La section commence par « Mes projets · N » et son « + » : plus de grand bouton au-dessus.
    expect(within(analyser).getByRole('link', { name: 'Mes projets · 1' })).toBeInTheDocument();
    expect(within(analyser).getByRole('link', { name: 'Nouveau projet' })).toBeInTheDocument();
    expect(within(analyser).getByRole('link', { name: NOM_EXEMPLE })).toBeInTheDocument();

    const horsZone = [
      within(barre).getByRole('button', { name: 'Fermer le menu' }),
      within(barre).getByRole('navigation', { name: 'Outils' }),
      within(barre).getByText('Gratuit · 1 projet'),
    ];
    for (const element of horsZone) {
      expect(barre).toContainElement(element);
      expect(zone).not.toContainElement(element);
    }
  });
});

describe('En-tête du projet collé', () => {
  it('reste collé en haut du contenu, avec un décalage négatif sous 768 px et 0 au-delà', async () => {
    await ouvrirExemple();
    expect(enTete()).toHaveClass(
      'sticky',
      'top-[calc(-1*var(--decalage-entete,0px))]',
      'md:top-0',
      'z-20',
      'print:hidden',
    );
    const volets = within(enTete()).getByRole('navigation', { name: 'Volets du rapport' });
    expect(within(volets).getAllByRole('link')).toHaveLength(7);
    expect(within(enTete()).getByRole('link', { name: 'Mes projets' })).toBeInTheDocument();
    expect(within(enTete()).getByText('155 000 € · meublé longue durée')).toBeInTheDocument();
  });

  it('publie le début de la bande et la hauteur collée sur le cadre quand ResizeObserver mesure', async () => {
    simulerResizeObserver();
    await ouvrirExemple();

    const observateur = ObservateurDeTest.instances.find((o) => o.observes.includes(enTete()));
    expect(observateur).toBeDefined();
    const volets = within(enTete()).getByRole('navigation', { name: 'Volets du rapport' });
    const rectangle = (top: number): DOMRect =>
      ({ top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top }) as DOMRect;
    enTete().getBoundingClientRect = () => rectangle(40);
    volets.getBoundingClientRect = () => rectangle(156);
    Object.defineProperty(enTete(), 'offsetHeight', { configurable: true, value: 160 });

    act(() => {
      observateur?.rappel();
    });
    const cadre = cadreProjet();
    expect(cadre.style.getPropertyValue('--decalage-entete')).toBe('116px');
    // jsdom ne calcule pas `top` : la hauteur collée est la hauteur entière.
    expect(cadre.style.getPropertyValue('--hauteur-entete-projet')).toBe('160px');
  });

  it("ne publie rien sans ResizeObserver, et la synthèse d'Hypothèses se colle sous l'en-tête", async () => {
    const utilisateur = await ouvrirExemple();
    expect(cadreProjet().style.getPropertyValue('--decalage-entete')).toBe('');
    expect(cadreProjet().style.getPropertyValue('--hauteur-entete-projet')).toBe('');

    const volets = screen.getByRole('navigation', { name: 'Volets du rapport' });
    await utilisateur.click(within(volets).getByRole('link', { name: 'Hypothèses' }));
    await screen.findByRole('heading', { level: 1, name: 'Vos hypothèses' });
    const synthese = screen.getByText('Cash-flow', { exact: true }).closest('.sticky');
    expect(synthese).not.toBeNull();
    expect(synthese).toHaveClass('top-[var(--hauteur-entete-projet,0px)]', 'z-10');
  });

  it('se déconnecte quand on quitte le projet', async () => {
    simulerResizeObserver();
    const utilisateur = await ouvrirExemple();
    const observateur = ObservateurDeTest.instances.find((o) => o.observes.includes(enTete()));
    expect(observateur?.deconnecte).toBe(false);
    await utilisateur.click(within(enTete()).getByRole('link', { name: 'Mes projets' }));
    await screen.findByRole('heading', { level: 1, name: 'Mes projets' });
    expect(observateur?.deconnecte).toBe(true);
  });
});

describe("Mesures de l'en-tête (fonctions pures)", () => {
  it('lit le top calculé : vide ou auto → 0, sinon la valeur en px', () => {
    expect(lireDecalage('')).toBe(0);
    expect(lireDecalage('auto')).toBe(0);
    expect(lireDecalage('0px')).toBe(0);
    expect(lireDecalage('-116px')).toBe(-116);
    expect(lireDecalage('-116.5px')).toBe(-116.5);
  });

  it('hauteur collée : la hauteur moins ce que le top négatif cache, jamais négative', () => {
    expect(hauteurCollee(160, -116)).toBe(44);
    expect(hauteurCollee(93, 0)).toBe(93);
    expect(hauteurCollee(93, 10)).toBe(93);
    expect(hauteurCollee(40, -60)).toBe(0);
    expect(hauteurCollee(0, 0)).toBe(0);
  });

  it('arrondit en px', () => {
    expect(enPixels(116.4)).toBe('116px');
    expect(enPixels(43.6)).toBe('44px');
    expect(enPixels(0)).toBe('0px');
  });
});
