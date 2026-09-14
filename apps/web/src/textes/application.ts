/** Textes de Deklic installée comme application, sur téléphone, tablette ou ordinateur. */
export const TEXTES_INSTALLATION = {
  bouton: "Installer l'application",
} as const;

/** Une annonce reçue par la feuille de partage du téléphone (cible de partage du manifeste). */
export const TEXTES_PARTAGE_RECU = {
  pastille: 'reçue par partage',
} as const;

/** La carte « Sur téléphone et tablette » de la page Extension. */
export const TEXTES_CARTE_TELEPHONE = {
  titre: 'Sur téléphone et tablette',
  appareils: 'Android · iPhone · iPad',
  intro:
    "L'extension et le bouton-favori n'existent que sur ordinateur. Sur téléphone et tablette, Deklic s'installe comme une application et s'ouvre même sans réseau.",
  installee: "L'application est installée : ouvrez Deklic depuis votre écran d'accueil.",
  installerAndroid: "Android : menu ⋮ du navigateur, puis « Installer l'application ».",
  installerIphone: "iPhone et iPad : bouton Partager de Safari, puis « Sur l'écran d'accueil ».",
  envoyerTitre: 'Envoyer une annonce à Deklic',
  envoyerAndroid:
    "Android, application installée : dans l'app du portail, touchez Partager, puis Deklic.",
  envoyerPartout: "Partout : copiez le lien de l'annonce et collez-le dans Nouveau projet.",
} as const;
