/**
 * Service d'arrière-plan : reçoit du script « pont » les demandes de lecture faites par Deklic et
 * les exécute dans un onglet du navigateur de l'utilisateur. Aucune requête vers nos serveurs.
 */
import { MOTIFS_PORTAILS } from '@loupe/capture';
import * as z from 'zod';

import { creerLecteur, type Navigateur, type OngletOrigine } from './logique/lecteur';
import { REGISTRE } from './regles';

export const DemandeLectureSchema = z.object({
  type: z.literal('deklic-lire'),
  url: z.url().max(2_000),
});

/** Résout `true` quand l'onglet a fini de charger, `false` au bout du délai. */
export function attendreChargement(tabId: number, delaiMs: number): Promise<boolean> {
  return new Promise((resoudre) => {
    let fini = false;
    const ecouter = (id: number, changement: { status?: string }): void => {
      if (id === tabId && changement.status === 'complete') terminer(true);
    };
    const minuterie = setTimeout(() => {
      terminer(false);
    }, delaiMs);
    function terminer(charge: boolean): void {
      if (fini) return;
      fini = true;
      clearTimeout(minuterie);
      chrome.tabs.onUpdated.removeListener(ecouter);
      resoudre(charge);
    }
    chrome.tabs.onUpdated.addListener(ecouter);
    chrome.tabs.get(tabId).then(
      (onglet) => {
        if (onglet.status === 'complete') terminer(true);
      },
      () => {
        terminer(false);
      },
    );
  });
}

export const NAVIGATEUR: Navigateur = {
  permis: (portail) => chrome.permissions.contains({ origins: [MOTIFS_PORTAILS[portail]] }),
  ouvrir: async (url, origine) => {
    const onglet = await chrome.tabs.create({
      url,
      active: false,
      ...(origine.windowId === undefined ? {} : { windowId: origine.windowId }),
      ...(origine.index === undefined ? {} : { index: origine.index + 1 }),
      ...(origine.tabId === undefined ? {} : { openerTabId: origine.tabId }),
    });
    if (onglet.id === undefined) throw new Error('onglet sans identifiant');
    return onglet.id;
  },
  attendreChargement,
  lire: async (tabId) => {
    const [resultat] = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contenu.js'],
    });
    return resultat?.result;
  },
  afficher: async (tabId) => {
    await chrome.tabs.update(tabId, { active: true });
  },
  fermer: async (tabId) => {
    await chrome.tabs.remove(tabId).catch(() => undefined);
  },
  revenir: async (origine) => {
    if (origine.tabId === undefined) return;
    await chrome.tabs.update(origine.tabId, { active: true }).catch(() => undefined);
  },
  dormir: (ms) =>
    new Promise((resoudre) => {
      setTimeout(resoudre, ms);
    }),
};

type Lecteur = (url: string, origine: OngletOrigine) => Promise<unknown>;

/** Branche l'écoute des demandes ; seules celles venant de cette extension sont traitées. */
export function ecouterDemandes(lire: Lecteur): void {
  chrome.runtime.onMessage.addListener((message: unknown, expediteur, repondre) => {
    const demande = DemandeLectureSchema.safeParse(message);
    if (!demande.success || expediteur.id !== chrome.runtime.id) return false;
    const onglet = expediteur.tab;
    void lire(demande.data.url, {
      tabId: onglet?.id,
      windowId: onglet?.windowId,
      index: onglet?.index,
    }).then(repondre);
    return true;
  });
}

ecouterDemandes(creerLecteur(NAVIGATEUR, REGISTRE));
