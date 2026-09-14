import { feu, honorairesAgence, parametreEcartPrix } from '../contexte';
import type { QuestionVisite } from '../types';

const NOTAIRES_VISITE = 'Notaires de France, « Visiter un bien immobilier »';

/** À demander au vendeur ou à l'agence. */
export const QUESTIONS_VENDEUR: readonly QuestionVisite[] = [
  {
    id: 'VEN_MOTIF_DELAI',
    categorie: 'vendeur',
    texte:
      'Pourquoi vendez-vous, et depuis quand le bien est-il en vente ? Y a-t-il eu des offres ? (marge de négociation)',
    source: 'Notaires de France, « Négocier le prix »',
  },
  {
    id: 'VEN_PRIX_SOUS_MARCHE',
    categorie: 'vendeur',
    condition: feu('prix', 'bon'),
    texte:
      'Le prix est {ecart} sous les ventes comparables : pourquoi ? (travaux, procédure, nuisance, urgence, succession)',
    source: 'Spec Deklic (feu prix)',
    parametres: parametreEcartPrix,
  },
  {
    id: 'VEN_PRIX_AU_DESSUS',
    categorie: 'vendeur',
    condition: feu('prix', 'probleme'),
    texte:
      "Le prix est {ecart} au-dessus des ventes comparables : sur quoi le vendeur s'appuie-t-il ? Prévoir la négociation.",
    source: 'Spec Deklic (feu prix)',
    parametres: parametreEcartPrix,
  },
  {
    id: 'VEN_TRAVAUX_FAITS',
    categorie: 'vendeur',
    texte:
      'Quels travaux ont été faits, quand et par qui ? Factures, garantie décennale, attestations de conformité (électricité, gaz).',
    source: NOTAIRES_VISITE,
  },
  {
    id: 'VEN_SINISTRES',
    categorie: 'vendeur',
    texte:
      "Y a-t-il eu des sinistres (dégât des eaux, infiltration, fissures) et des déclarations à l'assurance ?",
    source: NOTAIRES_VISITE,
  },
  {
    id: 'VEN_VOISINAGE',
    categorie: 'vendeur',
    texte: 'Litiges en cours avec des voisins ou la copropriété ? Nuisances connues ?',
    source: 'ANIL, « Visiter un logement »',
  },
  {
    id: 'VEN_OCCUPATION',
    categorie: 'vendeur',
    texte:
      'Le bien est-il libre ou occupé à la vente ? Si occupé : bail, fin du bail, locataire à jour, dépôt de garantie transféré.',
    source: 'ANIL, « Acheter un logement loué »',
  },
  {
    id: 'VEN_FACTURES_ENERGIE',
    categorie: 'vendeur',
    texte:
      "Factures réelles d'énergie et d'eau sur un an, à comparer au DPE et aux charges annoncées.",
    source: 'ADEME, « Le DPE »',
  },
  {
    id: 'VEN_HONORAIRES',
    categorie: 'vendeur',
    condition: honorairesAgence,
    texte:
      "Les honoraires d'agence ({honoraires}) sont-ils à la charge de l'acquéreur ou du vendeur ? Négociables ?",
    source: 'Spec Deklic',
    parametres: (c) => ({ honoraires: c.projet.hypotheses.achat.honorairesAgence }),
  },
  {
    id: 'VEN_CALENDRIER',
    categorie: 'vendeur',
    texte:
      "Date de disponibilité et de signature souhaitée ; condition suspensive d'obtention du prêt acceptée ?",
    source: 'Notaires de France, « La promesse de vente »',
  },
];
