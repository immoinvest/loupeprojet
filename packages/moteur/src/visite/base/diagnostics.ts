import {
  construitAvant,
  copro,
  dpeParmi,
  exploitationParmi,
  installationsAnciennes,
  maison,
  parametreAnnee,
  parametreChambreM2,
  tous,
  travauxPrevus,
} from '../contexte';
import type { QuestionVisite } from '../types';

/** Diagnostics du dossier technique et travaux, votés ou à prévoir. */
export const QUESTIONS_DIAGNOSTICS: readonly QuestionVisite[] = [
  {
    id: 'DIAG_AMIANTE',
    categorie: 'diagnostics',
    condition: construitAvant('amianteAvantAnnee'),
    texte:
      "Permis de construire d'avant juillet 1997 (construction {annee}) : le diagnostic amiante est-il fourni, et signale-t-il des matériaux à surveiller ou à retirer ?",
    source:
      'Service-public.fr, « Diagnostic amiante » ; art. L1334-13 du Code de la santé publique',
    parametres: parametreAnnee,
  },
  {
    id: 'DIAG_PLOMB',
    categorie: 'diagnostics',
    condition: construitAvant('plombAvantAnnee'),
    texte:
      "Logement d'avant 1949 (construction {annee}) : le constat de risque d'exposition au plomb (CREP) est-il fourni ? Peintures dégradées à traiter avant de louer.",
    source:
      'Service-public.fr, « Diagnostic plomb (CREP) » ; art. L1334-5 du Code de la santé publique',
    parametres: parametreAnnee,
  },
  {
    id: 'DIAG_ELECTRICITE_GAZ',
    categorie: 'diagnostics',
    condition: installationsAnciennes,
    texte:
      'Installations électrique et gaz de plus de quinze ans : les diagnostics sont-ils fournis, et quelles anomalies relèvent-ils (mise en sécurité à prévoir) ?',
    source: 'Service-public.fr, « Diagnostics électricité et gaz » ; art. L134-7 du CCH',
  },
  {
    id: 'DIAG_TERMITES',
    categorie: 'diagnostics',
    texte:
      'La commune est-elle en zone termites (arrêté préfectoral) ? Si oui, diagnostic termites de moins de six mois.',
    source: 'Service-public.fr, « Diagnostic termites » ; art. L126-24 du CCH',
  },
  {
    id: 'DIAG_MERULE',
    categorie: 'diagnostics',
    condition: maison,
    texte:
      'La commune est-elle dans une zone à mérule (arrêté préfectoral) ? Bois, charpente et humidité à inspecter de près.',
    source: 'Service-public.fr, « Mérule : information des acquéreurs » ; art. L126-7 du CCH',
  },
  {
    id: 'TRAVAUX_VOTES',
    categorie: 'diagnostics',
    condition: copro,
    texte:
      'Des travaux ont-ils été votés en assemblée générale et restent-ils à payer (ravalement, toiture, ascenseur) ? Quote-part à ajouter aux travaux du projet.',
    source: "Loi ALUR, art. L721-2 du CCH (procès-verbaux d'assemblée générale)",
    valeur: { chemin: 'hypotheses.achat.travaux', type: 'euros' },
  },
  {
    id: 'TRAVAUX_A_VENIR',
    categorie: 'diagnostics',
    condition: copro,
    texte:
      "Des travaux sont-ils à l'ordre du jour de la prochaine assemblée générale, ou signalés dans le carnet d'entretien et le plan pluriannuel ?",
    source: 'Loi Climat et résilience du 22 août 2021, art. 171',
  },
  {
    id: 'TRAVAUX_RENOVATION_ENERGETIQUE',
    categorie: 'diagnostics',
    condition: dpeParmi('E', 'F', 'G'),
    texte:
      'DPE {dpe} : location interdite à partir de {annee} sans rénovation énergétique. Quels travaux, à quel coût (devis), avec quelles aides ?',
    source: 'Loi Climat et résilience du 22 août 2021, art. 160',
    parametres: (c) => {
      const { dpe } = c.projet.bien;
      const interdiction = c.regles.exploitation.interdictionLocationDpe;
      return {
        dpe: dpe ?? '',
        annee: dpe === 'E' || dpe === 'F' || dpe === 'G' ? interdiction[dpe] : 0,
      };
    },
  },
  {
    id: 'TRAVAUX_CHIFFRAGE',
    categorie: 'diagnostics',
    condition: travauxPrevus,
    texte:
      "Travaux prévus ({travaux}) : un artisan a-t-il chiffré sur devis ? Sinon, le montant est-il réaliste pour l'état constaté (cuisine, salle d'eau, électricité, sols) ?",
    source: 'Spec Deklic',
    parametres: (c) => ({ travaux: c.projet.hypotheses.achat.travaux }),
  },
  {
    id: 'TRAVAUX_AUTORISATIONS',
    categorie: 'diagnostics',
    condition: tous(travauxPrevus, copro),
    texte:
      "Les travaux touchent-ils aux parties communes ou à l'aspect extérieur (fenêtres, façade, murs porteurs, gaines) ? Autorisation d'assemblée générale nécessaire.",
    source: 'Art. 25 b de la loi du 10 juillet 1965',
  },
  {
    id: 'TRAVAUX_DIVISION_COLOCATION',
    categorie: 'diagnostics',
    condition: exploitationParmi('colocation'),
    texte:
      'Créer ou cloisonner des chambres : chacune gardera-t-elle au moins {chambreM2} m², une fenêtre et un accès direct aux pièces communes ?',
    source: 'Décret 2002-120 du 30 janvier 2002 (décence), art. 4',
    parametres: parametreChambreM2,
  },
];
