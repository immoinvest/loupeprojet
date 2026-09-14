/**
 * Délai avant de libérer l'adresse du fichier. Révoquée dans la foulée du clic, Chromium annule
 * parfois le téléchargement avant de l'avoir lu (constaté sur une machine chargée).
 */
const DELAI_REVOCATION_MS = 10_000;

/**
 * Propose un fichier texte au téléchargement. Seul effet du simulateur : le contenu est
 * produit par une fonction pure (`csvAmortissement`), testée sur son texte exact.
 */
export function telechargerTexte(nom: string, contenu: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, DELAI_REVOCATION_MS);
}
