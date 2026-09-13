/**
 * Popup de l'extension : reconnaît l'onglet actif, injecte le script de contenu au clic, puis
 * ouvre Loupe avec la capture dans le fragment d'URL. Aucune requête réseau ici non plus.
 */
import { urlDeCapture } from '@loupe/capture';

import { baseUrl } from './config';
import { ResultatLectureSchema } from './logique/lire-page';
import {
  MESSAGE_LECTURE_IMPOSSIBLE,
  etatPourUrl,
  messagePourRaison,
  resumeCapture,
} from './logique/popup';

interface MondeIsole {
  __loupeCapture?: unknown;
}

function element(id: string): HTMLElement {
  const trouve = document.getElementById(id);
  if (trouve === null) throw new Error(`Élément #${id} introuvable dans le popup`);
  return trouve;
}

const statut = element('statut');
const bouton = element('analyser') as HTMLButtonElement;
const lienLoupe = element('ouvrir') as HTMLAnchorElement;

function afficher(message: string): void {
  statut.textContent = message;
}

/** Injecte le script de contenu et récupère ce qu'il a déposé (valeur de complétion, sinon relecture). */
async function lireOnglet(tabId: number): Promise<unknown> {
  const [premier] = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['contenu.js'],
  });
  if (premier?.result !== undefined) return premier.result;
  const [second] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (globalThis as MondeIsole).__loupeCapture,
  });
  return second?.result;
}

async function analyser(tabId: number): Promise<void> {
  bouton.disabled = true;
  afficher('Lecture de la page…');
  try {
    const lecture = ResultatLectureSchema.safeParse(await lireOnglet(tabId));
    if (!lecture.success) {
      afficher(MESSAGE_LECTURE_IMPOSSIBLE);
      bouton.disabled = false;
      return;
    }
    if (!lecture.data.ok) {
      afficher(messagePourRaison(lecture.data.raison));
      bouton.disabled = false;
      return;
    }
    afficher(`Lu : ${resumeCapture(lecture.data.capture)}. Ouverture de Loupe…`);
    await chrome.tabs.create({ url: urlDeCapture(baseUrl(), lecture.data.capture) });
    window.close();
  } catch {
    afficher(MESSAGE_LECTURE_IMPOSSIBLE);
    bouton.disabled = false;
  }
}

async function demarrer(): Promise<void> {
  lienLoupe.href = baseUrl();
  const [onglet] = await chrome.tabs.query({ active: true, currentWindow: true });
  const etat = etatPourUrl(onglet?.url);
  afficher(etat.message);
  const tabId = onglet?.id;
  if (etat.statut !== 'annonce' || tabId === undefined) return;
  bouton.disabled = false;
  bouton.addEventListener('click', () => {
    void analyser(tabId);
  });
}

void demarrer();
