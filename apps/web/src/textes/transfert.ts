/** Page /transfert : les projets arrivés de l'ancienne adresse de Deklic. */

function projets(n: number): string {
  return n === 1 ? '1 projet' : `${String(n)} projets`;
}

export const TEXTES_TRANSFERT = {
  titre: 'Récupérer mes projets',
  chargement: 'Récupération de vos projets…',
  lienProjets: 'Voir mes projets',
  bilan: (ajoutes: number, remplaces: number): string =>
    ajoutes + remplaces === 0
      ? 'Vos projets étaient déjà sur cet appareil : rien à ajouter.'
      : `${projets(ajoutes + remplaces)} ${ajoutes + remplaces === 1 ? 'récupéré' : 'récupérés'} depuis l’ancienne adresse de Deklic.`,
  gardes: (n: number): string =>
    `${projets(n)} ${n === 1 ? 'était déjà plus récent' : 'étaient déjà plus récents'} sur cet appareil : ${n === 1 ? 'il est gardé' : 'ils sont gardés'}.`,
  ignores: (n: number): string =>
    `${projets(n)} ${n === 1 ? 'n’a' : 'n’ont'} pas pu être lu${n === 1 ? '' : 's'} et ${n === 1 ? 'est laissé' : 'sont laissés'} de côté.`,
  raisons: {
    vide: 'Cette adresse ne contient aucun projet à récupérer.',
    illisible:
      'Le transfert est incomplet ou abîmé. Rouvrez l’ancienne adresse de Deklic pour le relancer.',
    invalide: 'Ce transfert vient d’une version de Deklic que celle-ci ne sait pas lire.',
  },
} as const;
