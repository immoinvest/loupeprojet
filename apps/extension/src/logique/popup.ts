import { PORTAILS, resoudreAnnonce, type Capture, type Portail } from '@loupe/capture';

import type { RaisonLecture } from './lire-page';

export type StatutOnglet = 'annonce' | 'hors-annonce' | 'sans-onglet';

export interface EtatOnglet {
  readonly statut: StatutOnglet;
  readonly message: string;
  readonly portail?: Portail;
}

const PORTAILS_LISTE = "LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo";

/** Ce que le popup affiche selon l'onglet actif, avant tout clic. */
export function etatPourUrl(url: string | undefined): EtatOnglet {
  if (url === undefined) {
    return { statut: 'sans-onglet', message: `Ouvrez une annonce ${PORTAILS_LISTE}.` };
  }
  const annonce = resoudreAnnonce(url);
  if (annonce === null) {
    return {
      statut: 'hors-annonce',
      message: `Cette page n'est pas une annonce. Ouvrez une annonce ${PORTAILS_LISTE}.`,
    };
  }
  return {
    statut: 'annonce',
    portail: annonce.portail,
    message: `Annonce ${PORTAILS[annonce.portail]} reconnue. Un clic, et Deklic la lit.`,
  };
}

const EUROS = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** « 155 000 € · 65 m² · Marseille (13005) », avec ce qui a été lu. */
export function resumeCapture(capture: Capture): string {
  const morceaux: string[] = [];
  if (capture.prix !== undefined) morceaux.push(`${EUROS.format(capture.prix)} €`);
  if (capture.surface !== undefined) morceaux.push(`${String(capture.surface)} m²`);
  if (capture.ville !== undefined) {
    morceaux.push(
      capture.codePostal === undefined ? capture.ville : `${capture.ville} (${capture.codePostal})`,
    );
  }
  return morceaux.length === 0
    ? 'aucun chiffre reconnu, tout reste à saisir'
    : morceaux.join(' · ');
}

export function messagePourRaison(raison: RaisonLecture): string {
  switch (raison) {
    case 'hors-annonce':
      return `Cette page n'est pas une annonce. Ouvrez une annonce ${PORTAILS_LISTE}.`;
    case 'portail-sans-regles':
      return "Ce portail n'a pas encore de règles de lecture. Collez le texte de l'annonce dans Deklic, ça marche aussi.";
  }
}

export const MESSAGE_LECTURE_IMPOSSIBLE =
  "Impossible de lire cette page. Collez le texte de l'annonce dans Deklic, ça marche aussi.";
