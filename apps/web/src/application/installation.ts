/**
 * Installation de Deklic comme application (PWA). L'état n'est jamais stocké : il se relit à chaque
 * ouverture, depuis les événements du navigateur et le mode d'affichage.
 */

/**
 * `indisponible` : le navigateur ne propose rien (iPhone, Firefox, invite refusée) ;
 * `disponible` : une invite est gardée pour le bouton ; `installee` : ouverte en application.
 */
export type EtatInstallation = 'indisponible' | 'disponible' | 'installee';

export type ResultatInstallation = 'acceptee' | 'refusee' | 'indisponible';

/** L'événement `beforeinstallprompt` (Chrome, Edge, Android) : il n'est pas dans les types du DOM. */
interface InviteInstallation extends Event {
  readonly prompt: () => Promise<unknown>;
  readonly userChoice: Promise<{ readonly outcome: string }>;
}

/** Ce que le suivi lit de la fenêtre, injecté pour être testé sans navigateur. */
export interface FenetreInstallation {
  readonly addEventListener: (type: string, ecouteur: (evenement: Event) => void) => void;
  readonly matchMedia?: (requete: string) => { readonly matches: boolean };
  readonly navigator?: object;
}

export interface SuiviInstallation {
  readonly lire: () => EtatInstallation;
  readonly abonner: (ecouteur: () => void) => () => void;
  readonly installer: () => Promise<ResultatInstallation>;
}

/** Sans navigateur (tests, rendu hors page) : rien à installer. */
export const suiviIndisponible: SuiviInstallation = {
  lire: () => 'indisponible',
  abonner: () => () => undefined,
  installer: () => Promise.resolve('indisponible'),
};

const REQUETE_APPLICATION = '(display-mode: standalone)';

/** Ouverte depuis l'écran d'accueil : mode `standalone`, ou `navigator.standalone` sur iPhone. */
function estOuverteEnApplication(fenetre: FenetreInstallation): boolean {
  const navigateur = fenetre.navigator;
  if (navigateur !== undefined && 'standalone' in navigateur && navigateur.standalone === true) {
    return true;
  }
  return fenetre.matchMedia?.(REQUETE_APPLICATION).matches ?? false;
}

function estInvite(evenement: Event): evenement is InviteInstallation {
  return (
    'prompt' in evenement && typeof evenement.prompt === 'function' && 'userChoice' in evenement
  );
}

/** Suit l'invite d'installation du navigateur et le mode application, pour une page. */
export function creerSuiviInstallation(
  fenetre: FenetreInstallation | undefined,
): SuiviInstallation {
  if (fenetre === undefined) return suiviIndisponible;
  let etat: EtatInstallation = estOuverteEnApplication(fenetre) ? 'installee' : 'indisponible';
  let invite: InviteInstallation | null = null;
  const ecouteurs = new Set<() => void>();

  const passerA = (suivant: EtatInstallation): void => {
    if (suivant === etat) return;
    etat = suivant;
    ecouteurs.forEach((ecouteur) => {
      ecouteur();
    });
  };

  fenetre.addEventListener('beforeinstallprompt', (evenement) => {
    if (etat === 'installee' || !estInvite(evenement)) return;
    // Pas de bandeau du navigateur : l'invite attend le bouton « Installer l'application ».
    evenement.preventDefault();
    invite = evenement;
    passerA('disponible');
  });
  fenetre.addEventListener('appinstalled', () => {
    invite = null;
    passerA('installee');
  });

  const installer = async (): Promise<ResultatInstallation> => {
    const courante = invite;
    if (courante === null) return 'indisponible';
    // Une invite ne sert qu'une fois ; le navigateur en émettra une autre s'il le juge utile.
    invite = null;
    try {
      await courante.prompt();
      const { outcome } = await courante.userChoice;
      const acceptee = outcome === 'accepted';
      passerA(acceptee ? 'installee' : 'indisponible');
      return acceptee ? 'acceptee' : 'refusee';
    } catch {
      passerA('indisponible');
      return 'indisponible';
    }
  };

  return {
    lire: () => etat,
    abonner: (ecouteur) => {
      ecouteurs.add(ecouteur);
      return () => {
        ecouteurs.delete(ecouteur);
      };
    },
    installer,
  };
}
