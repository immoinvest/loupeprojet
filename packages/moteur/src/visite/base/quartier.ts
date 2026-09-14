import { enZoneARisque, risquesSignales } from '../contexte';
import type { QuestionVisite } from '../types';

/** Le quartier : ce que cherchent les locataires, et ce qui peut gêner. */
export const QUESTIONS_QUARTIER: readonly QuestionVisite[] = [
  {
    id: 'QUA_TRANSPORTS_SERVICES',
    categorie: 'quartier',
    texte:
      'À pied depuis le bien : transports, commerces, écoles ou campus, santé. Ce que cherchent vos futurs locataires.',
    source: 'ANIL, « Choisir son logement »',
  },
  {
    id: 'QUA_DEMANDE_LOCATIVE',
    categorie: 'quartier',
    texte:
      "Demande locative : combien d'annonces de location comparables en ligne, à quel loyer, depuis combien de temps ? Un logement vide depuis des semaines est un signal.",
    source: 'Spec Deklic',
  },
  {
    id: 'QUA_NUISANCES_URBANISME',
    categorie: 'quartier',
    texte:
      "Nuisances et projets : trafic, bars, chantiers ; consulter le PLU et les projets d'urbanisme en mairie (construction en face, ligne de tram).",
    source: 'Notaires de France, « Visiter un bien immobilier »',
  },
  {
    id: 'QUA_RISQUES',
    categorie: 'quartier',
    condition: enZoneARisque,
    texte:
      "Zone à risque ({risques}) : lire l'état des risques, demander les sinistres passés (arrêté de catastrophe naturelle, inondation de cave, fissures) et le coût de l'assurance.",
    source: "Géorisques (état des risques) ; art. L125-5 du Code de l'environnement",
    parametres: (c) => ({ risques: risquesSignales(c).join(',') }),
  },
];
