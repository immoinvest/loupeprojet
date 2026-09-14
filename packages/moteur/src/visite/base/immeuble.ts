import {
  anneeInconnue,
  appartement,
  avecAscenseur,
  copro,
  coproEnProcedure,
  lotsInconnus,
  maison,
} from '../contexte';
import type { QuestionVisite } from '../types';

/** L'immeuble, la copropriété, le terrain d'une maison. */
export const QUESTIONS_IMMEUBLE: readonly QuestionVisite[] = [
  {
    id: 'IMM_PARTIES_COMMUNES',
    categorie: 'immeuble',
    condition: appartement,
    texte:
      "Parties communes : propreté, éclairage, porte d'entrée et interphone, boîtes aux lettres, local vélos et poubelles, cage d'escalier.",
    source: 'ANIL, « Visiter un logement »',
  },
  {
    id: 'IMM_FACADE_TOITURE',
    categorie: 'immeuble',
    texte:
      'Façade et toiture : fissures, ravalement récent ou à prévoir, gouttières, état de la toiture (tuiles, zinc, terrasse).',
    source: 'Notaires de France, « Visiter un bien immobilier »',
  },
  {
    id: 'IMM_ASCENSEUR',
    categorie: 'immeuble',
    condition: avecAscenseur,
    texte:
      "Ascenseur : date de mise aux normes, contrat d'entretien, pannes récentes (demander au gardien ou à un voisin).",
    source: 'Spec Deklic',
  },
  {
    id: 'IMM_ANNEE_CONSTRUCTION',
    categorie: 'immeuble',
    condition: anneeInconnue,
    texte:
      "Quelle est l'année de construction ? Elle déclenche les diagnostics amiante (avant {amiante}) et plomb (avant {plomb}).",
    source: 'Service-public.fr, « Dossier de diagnostic technique »',
    parametres: (c) => ({
      amiante: c.regles.visite.amianteAvantAnnee,
      plomb: c.regles.visite.plombAvantAnnee,
    }),
    valeur: { chemin: 'bien.annee', type: 'entier' },
  },
  {
    id: 'IMM_LOTS',
    categorie: 'immeuble',
    condition: lotsInconnus,
    texte:
      'Combien de lots compte la copropriété ? Une petite copropriété répartit les gros travaux sur peu de têtes.',
    source: 'Spec Deklic',
    valeur: { chemin: 'bien.copro.lots', type: 'entier' },
  },
  {
    id: 'IMM_SYNDIC',
    categorie: 'immeuble',
    condition: copro,
    texte:
      "Syndic : professionnel ou bénévole, montant des honoraires, réactivité (avis d'un copropriétaire ou du gardien).",
    source: 'ANIL, « La copropriété »',
  },
  {
    id: 'IMM_COPRO_PROCEDURE',
    categorie: 'immeuble',
    condition: coproEnProcedure,
    texte:
      'La copropriété est en procédure (impayés, administrateur provisoire, contentieux) : lire le procès-verbal et le budget, mesurer les appels de fonds à venir avant toute offre.',
    source: 'Loi ALUR, art. L721-2 du CCH',
  },
  {
    id: 'IMM_MAISON_TERRAIN',
    categorie: 'immeuble',
    condition: maison,
    texte:
      'Terrain : limites et bornage, clôtures, servitudes de passage ou de vue, murs de soutènement, accès et stationnement.',
    source: 'Notaires de France, « Acheter une maison »',
  },
];
