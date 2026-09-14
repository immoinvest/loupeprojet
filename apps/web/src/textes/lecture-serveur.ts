import type { Portail } from '@loupe/capture';

import type { RaisonEchecServeur } from '@/annonces/lecture-serveur';

/** Le nom des portails tel qu'on le dit. */
export const NOMS_PORTAILS: Readonly<Record<Portail, string>> = {
  leboncoin: 'LeBonCoin',
  seloger: 'SeLoger',
  bienici: "Bien'ici",
  pap: 'PAP',
  logicimmo: 'Logic-Immo',
};

const REPLI = "Collez le texte de l'annonce ci-dessous, ça marche aussi.";

/** Pourquoi Deklic n'a pas pu lire l'annonce, en une phrase, avec ce que la personne peut faire. */
export function texteEchecServeur(raison: RaisonEchecServeur): string {
  switch (raison) {
    case 'indisponible':
      return `La lecture automatique n'est pas disponible pour le moment. ${REPLI}`;
    case 'introuvable':
      return `Cette annonce n'est plus en ligne (retirée ou déjà vendue ?). ${REPLI}`;
    case 'bloquee':
      return `Le portail n'a pas laissé lire l'annonce cette fois-ci. Réessayez dans un instant, ou collez son texte ci-dessous.`;
    case 'limite':
      return "Plusieurs lectures d'affilée : patientez une minute avant de relancer, ou collez le texte ci-dessous.";
    case 'reseau':
      return `Deklic n'a pas pu joindre son service de lecture (connexion coupée ?). ${REPLI}`;
    case 'vide':
      return `L'annonce a été ouverte, mais ni le prix ni la surface n'y ont été trouvés. ${REPLI}`;
    case 'annulee':
      return "Lecture annulée. Collez le texte de l'annonce ci-dessous, ou relancez la lecture.";
  }
}
