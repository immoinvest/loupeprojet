import { describe, expect, it, vi } from 'vitest';

import { creerSuiviInstallation, suiviIndisponible, type FenetreInstallation } from '@/application';

type Ecouteur = (evenement: Event) => void;

interface OptionsFenetre {
  /** `display-mode: standalone` (application ouverte depuis l'écran d'accueil). */
  readonly autonome?: boolean;
  /** `navigator.standalone` (iPhone) ; absent si non précisé. */
  readonly standalone?: boolean;
  readonly sansMatchMedia?: boolean;
  readonly sansNavigateur?: boolean;
}

function fenetreDeTest(options: OptionsFenetre = {}): {
  fenetre: FenetreInstallation;
  emettre: (type: string, evenement?: Event) => void;
} {
  const ecouteurs = new Map<string, Ecouteur[]>();
  const fenetre: FenetreInstallation = {
    addEventListener: (type, ecouteur) => {
      ecouteurs.set(type, [...(ecouteurs.get(type) ?? []), ecouteur]);
    },
    ...(options.sansMatchMedia === true
      ? {}
      : {
          matchMedia: (requete: string) => ({
            matches: options.autonome === true && requete === '(display-mode: standalone)',
          }),
        }),
    ...(options.sansNavigateur === true
      ? {}
      : { navigator: options.standalone === undefined ? {} : { standalone: options.standalone } }),
  };
  const emettre = (type: string, evenement: Event = new Event(type)): void => {
    for (const ecouteur of ecouteurs.get(type) ?? []) ecouteur(evenement);
  };
  return { fenetre, emettre };
}

/** Un `beforeinstallprompt` de Chrome : `prompt()` et le choix de la personne. */
function invite(outcome: string, prompt: () => Promise<unknown> = () => Promise.resolve()): Event {
  const evenement = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(evenement, { prompt, userChoice: Promise.resolve({ outcome }) });
}

describe('suiviIndisponible', () => {
  it('ne propose jamais rien', async () => {
    const desabonner = suiviIndisponible.abonner(() => undefined);
    desabonner();
    expect(suiviIndisponible.lire()).toBe('indisponible');
    await expect(suiviIndisponible.installer()).resolves.toBe('indisponible');
    expect(creerSuiviInstallation(undefined)).toBe(suiviIndisponible);
  });
});

describe('creerSuiviInstallation', () => {
  it('sans invite du navigateur, rien à installer', async () => {
    const { fenetre } = fenetreDeTest();
    const suivi = creerSuiviInstallation(fenetre);
    expect(suivi.lire()).toBe('indisponible');
    await expect(suivi.installer()).resolves.toBe('indisponible');
  });

  it('garde l’invite, prévient les abonnés, installe une seule fois', async () => {
    const { fenetre, emettre } = fenetreDeTest();
    const suivi = creerSuiviInstallation(fenetre);
    const abonne = vi.fn();
    const desabonner = suivi.abonner(abonne);
    const prompt = vi.fn(() => Promise.resolve());
    const evenement = invite('accepted', prompt);

    emettre('beforeinstallprompt', evenement);
    expect(evenement.defaultPrevented).toBe(true);
    expect(suivi.lire()).toBe('disponible');
    expect(abonne).toHaveBeenCalledTimes(1);

    await expect(suivi.installer()).resolves.toBe('acceptee');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(suivi.lire()).toBe('installee');
    expect(abonne).toHaveBeenCalledTimes(2);

    // L'invite est consommée ; appinstalled ne change plus rien ; le désabonné n'est plus prévenu.
    await expect(suivi.installer()).resolves.toBe('indisponible');
    desabonner();
    emettre('appinstalled');
    expect(abonne).toHaveBeenCalledTimes(2);
  });

  it('une invite refusée ou en erreur rend l’installation indisponible', async () => {
    const { fenetre, emettre } = fenetreDeTest();
    const suivi = creerSuiviInstallation(fenetre);

    emettre('beforeinstallprompt', invite('dismissed'));
    await expect(suivi.installer()).resolves.toBe('refusee');
    expect(suivi.lire()).toBe('indisponible');

    emettre(
      'beforeinstallprompt',
      invite('accepted', () => Promise.reject(new Error('déjà utilisée'))),
    );
    expect(suivi.lire()).toBe('disponible');
    await expect(suivi.installer()).resolves.toBe('indisponible');
    expect(suivi.lire()).toBe('indisponible');
  });

  it('ignore un événement qui n’est pas une invite', () => {
    const { fenetre, emettre } = fenetreDeTest();
    const suivi = creerSuiviInstallation(fenetre);
    emettre('beforeinstallprompt');
    emettre(
      'beforeinstallprompt',
      Object.assign(new Event('beforeinstallprompt'), { prompt: 'x' }),
    );
    emettre(
      'beforeinstallprompt',
      Object.assign(new Event('beforeinstallprompt'), { prompt: () => Promise.resolve() }),
    );
    expect(suivi.lire()).toBe('indisponible');
  });

  it('déjà ouverte en application : installée, et l’invite est ignorée', () => {
    const { fenetre, emettre } = fenetreDeTest({ autonome: true });
    const suivi = creerSuiviInstallation(fenetre);
    const evenement = invite('accepted');
    emettre('beforeinstallprompt', evenement);
    expect(evenement.defaultPrevented).toBe(false);
    expect(suivi.lire()).toBe('installee');
  });

  it('reconnaît l’iPhone (navigator.standalone) et les navigateurs sans matchMedia', () => {
    expect(creerSuiviInstallation(fenetreDeTest({ standalone: true }).fenetre).lire()).toBe(
      'installee',
    );
    const sansRien = fenetreDeTest({ standalone: false, sansMatchMedia: true });
    expect(creerSuiviInstallation(sansRien.fenetre).lire()).toBe('indisponible');
    const sansNavigateur = fenetreDeTest({ sansNavigateur: true, autonome: true });
    expect(creerSuiviInstallation(sansNavigateur.fenetre).lire()).toBe('installee');
  });

  it('installée par le menu du navigateur, sans invite : appinstalled suffit', () => {
    const { fenetre, emettre } = fenetreDeTest();
    const suivi = creerSuiviInstallation(fenetre);
    emettre('appinstalled');
    expect(suivi.lire()).toBe('installee');
  });
});
