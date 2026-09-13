import {
  MOTIFS_PORTAILS,
  PORTAILS,
  resoudreAnnonce,
  type Capture,
  type Portail,
  type RaisonEchecLecture,
} from '@loupe/capture';

export type StatutOnglet = 'annonce' | 'hors-annonce' | 'sans-onglet';

export interface EtatOnglet {
  readonly statut: StatutOnglet;
  readonly message: string;
  readonly portail?: Portail;
}

const PORTAILS_LISTE = "LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo";
const REPLI = "Collez le texte de l'annonce dans Deklic, ça marche aussi.";

/** Les cinq portails que l'extension doit pouvoir ouvrir et lire quand Deklic le demande. */
export const ORIGINES_PORTAILS: readonly string[] = Object.values(MOTIFS_PORTAILS);

export const MESSAGE_AUTORISEE = 'Lecture automatique autorisée : collez un lien dans Deklic.';

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

export function messagePourRaison(raison: RaisonEchecLecture): string {
  switch (raison) {
    case 'hors-annonce':
      return `Cette page n'est pas une annonce. Ouvrez une annonce ${PORTAILS_LISTE}.`;
    case 'portail-sans-regles':
      return `Ce portail n'a pas encore de règles de lecture. ${REPLI}`;
    case 'permission':
      return "L'extension n'a pas encore le droit de lire les portails : cliquez sur « Autoriser la lecture automatique ».";
    case 'chargement':
      return `L'annonce n'a pas pu être chargée. ${REPLI}`;
    case 'vide':
      return `Rien n'a pu être lu sur cette page. ${REPLI}`;
    case 'occupe':
      return 'Une lecture est déjà en cours, patientez quelques secondes.';
  }
}

export const MESSAGE_LECTURE_IMPOSSIBLE = `Impossible de lire cette page. ${REPLI}`;
