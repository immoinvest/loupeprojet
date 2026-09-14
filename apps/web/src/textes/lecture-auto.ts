import type { RaisonEchecLecture } from '@loupe/capture';

const REPLI = 'Vous pouvez aussi saisir les chiffres à la main.';

/** Pourquoi l'extension n'a rien rapporté, en une phrase, avec ce que l'utilisateur peut faire. */
export function texteEchecLecture(raison: RaisonEchecLecture): string {
  switch (raison) {
    case 'hors-annonce':
      return `Ce lien ne mène pas à une annonce lisible (annonce retirée ?). ${REPLI}`;
    case 'portail-sans-regles':
      return `L'extension ne sait pas encore lire ce portail. ${REPLI}`;
    case 'permission':
      return "L'extension Deklic n'a pas encore le droit de lire les portails : cliquez sur son icône, puis sur « Autoriser la lecture automatique ».";
    case 'chargement':
      return `L'annonce n'a pas pu être ouverte ou n'a pas répondu à temps. ${REPLI}`;
    case 'vide':
      return `L'annonce s'est ouverte mais rien n'a pu y être lu (vérification anti-robot ?). ${REPLI}`;
    case 'occupe':
      return "L'extension lit déjà une autre annonce : réessayez dans quelques secondes.";
  }
}
