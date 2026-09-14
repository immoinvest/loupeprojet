/** Adresse du service worker, construit par vite.hors-ligne.config.ts à la racine de dist/. */
export const URL_SERVICE_WORKER = '/sw.js';

/** Ce dont l'enregistrement a besoin, injecté pour être testé sans navigateur. */
export interface EnvironnementHorsLigne {
  /** Vrai dans le build de production : le serveur de développement n'a pas de service worker. */
  readonly production: boolean;
  /** `navigator.serviceWorker` ; absent des navigateurs sans service worker. */
  readonly conteneur:
    | {
        readonly register: (url: string, options: { readonly scope: string }) => Promise<unknown>;
      }
    | undefined;
  /** Lance l'action une fois la page chargée, pour ne pas ralentir le premier affichage. */
  readonly quandCharge: (action: () => void) => void;
}

/** Enregistre le service worker en production ; rend vrai si l'enregistrement est lancé. */
export function enregistrerServiceWorker(environnement: EnvironnementHorsLigne): boolean {
  const { production, conteneur, quandCharge } = environnement;
  if (!production || conteneur === undefined) return false;
  quandCharge(() => {
    // Un échec (navigation privée, stockage plein) laisse l'application fonctionner en ligne.
    void conteneur.register(URL_SERVICE_WORKER, { scope: '/' }).catch(() => undefined);
  });
  return true;
}
