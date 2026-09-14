import {
  avecExterieur,
  dpeInconnu,
  etageEleveSansAscenseur,
  meuble,
  non,
  parametreDpe,
  parametreEtage,
  rezDeChaussee,
} from '../contexte';
import type { QuestionVisite } from '../types';

const ANIL_VISITE = 'ANIL, « Visiter un logement »';
const NOTAIRES_VISITE = 'Notaires de France, « Visiter un bien immobilier »';

/** Ce qui se regarde sur place, dans le logement. */
export const QUESTIONS_LOGEMENT: readonly QuestionVisite[] = [
  {
    id: 'LOG_ETAT_GENERAL',
    categorie: 'logement',
    texte:
      "État général : sols, murs, plafonds ; traces d'humidité ou de moisissures dans les angles, derrière les meubles, sous les fenêtres ; odeurs.",
    source: `${ANIL_VISITE} ; ${NOTAIRES_VISITE}`,
  },
  {
    id: 'LOG_FENETRES',
    categorie: 'logement',
    texte:
      'Fenêtres : simple ou double vitrage, joints et fermetures, volets ; bruit de la rue fenêtres fermées puis ouvertes.',
    source: ANIL_VISITE,
  },
  {
    id: 'LOG_CHAUFFAGE_EAU_CHAUDE',
    categorie: 'logement',
    texte:
      'Chauffage et eau chaude : individuel ou collectif, énergie, âge de la chaudière ou du ballon, date du dernier entretien, thermostat.',
    source: `ADEME, « Le DPE » ; ${ANIL_VISITE}`,
  },
  {
    id: 'LOG_ELECTRICITE',
    categorie: 'logement',
    texte:
      'Tableau électrique : disjoncteur différentiel, prises reliées à la terre, nombre de prises par pièce, fils apparents.',
    source: 'Service-public.fr, « Diagnostic électricité »',
  },
  {
    id: 'LOG_PLOMBERIE_VENTILATION',
    categorie: 'logement',
    texte:
      "Plomberie et ventilation : pression et couleur de l'eau, évacuations, traces de fuite sous l'évier et dans la salle d'eau, VMC ou grilles d'aération.",
    source: ANIL_VISITE,
  },
  {
    id: 'LOG_DPE_COHERENCE',
    categorie: 'logement',
    condition: non(dpeInconnu),
    texte:
      'Le DPE {dpe} est-il cohérent avec ce que vous voyez (chauffage, vitrage, isolation, date du diagnostic) ? Corrigez la classe si le diagnostic complet dit autre chose.',
    source: 'ADEME, observatoire des DPE',
    parametres: parametreDpe,
    valeur: { chemin: 'bien.dpe', type: 'enum' },
  },
  {
    id: 'LOG_DPE_INCONNU',
    categorie: 'logement',
    condition: dpeInconnu,
    texte:
      "Quelle est la classe du DPE ? Elle est obligatoire dans l'annonce et conditionne le droit de louer.",
    source: 'Loi Climat et résilience du 22 août 2021, art. 160',
    valeur: { chemin: 'bien.dpe', type: 'enum' },
  },
  {
    id: 'LOG_SURFACE',
    categorie: 'logement',
    texte:
      "La surface annoncée ({surface} m²) correspond-elle ? Mesurer une pièce au télémètre ; en copropriété, l'attestation loi Carrez fait foi.",
    source: 'Loi Carrez, art. 46 de la loi du 10 juillet 1965',
    parametres: (c) => ({ surface: c.projet.bien.surface }),
    valeur: { chemin: 'bien.surface', type: 'nombre' },
  },
  {
    id: 'LOG_DECENCE',
    categorie: 'logement',
    texte:
      "Décence : au moins 9 m² et 2,20 m sous plafond (ou 20 m³) pour la pièce principale, ouverture sur l'extérieur, eau potable, WC et coin cuisine, chauffage.",
    source: 'Décret 2002-120 du 30 janvier 2002',
  },
  {
    id: 'LOG_ORIENTATION',
    categorie: 'logement',
    texte:
      'Orientation et luminosité : exposition, vis-à-vis, heure de la visite (revenir à une autre heure ou un autre jour si possible).',
    source: NOTAIRES_VISITE,
  },
  {
    id: 'LOG_AGENCEMENT',
    categorie: 'logement',
    texte:
      'Agencement pour la location : chambres fermées, cuisine équipable, rangements, place pour un lit double, pièces en enfilade à éviter.',
    source: 'Spec Deklic',
  },
  {
    id: 'LOG_BRUIT',
    categorie: 'logement',
    texte:
      "Bruit : voisins, cage d'escalier, ascenseur, local poubelles, commerce ou bar en dessous ; visiter un soir ou un week-end.",
    source: ANIL_VISITE,
  },
  {
    id: 'LOG_ETAGE_SANS_ASCENSEUR',
    categorie: 'logement',
    condition: etageEleveSansAscenseur,
    texte:
      "{etage}e étage sans ascenseur : état de la cage d'escalier, largeur pour les déménagements ; relocation plus lente et loyer un peu plus bas à prévoir.",
    source: 'Spec Deklic',
    parametres: parametreEtage,
  },
  {
    id: 'LOG_REZ_DE_CHAUSSEE',
    categorie: 'logement',
    condition: rezDeChaussee,
    texte:
      'Rez-de-chaussée : sécurité (barreaux, volets, porte), vis-à-vis depuis la rue, humidité, luminosité.',
    source: NOTAIRES_VISITE,
  },
  {
    id: 'LOG_EXTERIEUR',
    categorie: 'logement',
    condition: avecExterieur,
    texte:
      'Balcon ou terrasse : étanchéité, garde-corps, usage privatif confirmé par le règlement de copropriété.',
    source: 'Spec Deklic',
  },
  {
    id: 'LOG_ANNEXES',
    categorie: 'logement',
    texte:
      'Cave, parking, grenier : sont-ils dans le lot vendu ? Les visiter aussi (humidité, accès, sécurité).',
    source: NOTAIRES_VISITE,
  },
  {
    id: 'LOG_COMPTEURS',
    categorie: 'logement',
    texte:
      "Compteurs d'eau, d'électricité et de gaz : individuels ou répartition collective ? Relever leur emplacement et leur état.",
    source: ANIL_VISITE,
  },
  {
    id: 'LOG_MEUBLE_INVENTAIRE',
    categorie: 'logement',
    condition: meuble,
    texte:
      "Location meublée : le mobilier vendu avec le bien, s'il y en a, couvre-t-il la liste légale (literie, plaques, four ou micro-ondes, réfrigérateur, vaisselle, table et sièges, rangements, luminaires, rideaux, matériel d'entretien) ? Sinon, budget mobilier à prévoir.",
    source: 'Décret 2015-981 du 31 juillet 2015 (liste des meubles du logement meublé)',
  },
];
