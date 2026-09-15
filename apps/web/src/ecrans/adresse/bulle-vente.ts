import { PHRASES_CARTE, type FicheVente } from '@/textes/carte';

/**
 * Le contenu de la bulle d'une vente sur la carte, construit élément par élément : les textes (dont l'adresse DVF)
 * passent par `textContent`, jamais par du HTML en chaîne.
 */
export function elementBulle(fiche: FicheVente, onVoirTableau: (() => void) | null): HTMLElement {
  const racine = document.createElement('div');
  racine.className = 'carte-bulle';
  const titre = document.createElement('p');
  titre.className = 'carte-bulle-titre';
  titre.textContent = fiche.titre;
  const lignes = document.createElement('dl');
  lignes.className = 'carte-bulle-lignes';
  for (const ligne of fiche.lignes) {
    const terme = document.createElement('dt');
    terme.textContent = ligne.libelle;
    const valeur = document.createElement('dd');
    valeur.textContent = ligne.valeur;
    lignes.append(terme, valeur);
  }
  racine.append(titre);
  // Juste sous le titre : le bouton reste à portée même quand la fiche défile dans une petite carte (téléphone).
  if (onVoirTableau !== null) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'carte-bulle-bouton survol-texte';
    bouton.textContent = PHRASES_CARTE.voirTableau;
    bouton.addEventListener('click', onVoirTableau);
    racine.append(bouton);
  }
  racine.append(lignes);
  return racine;
}
