import { NOMS_CHAMPS } from './contrat';

/** À incrémenter à chaque changement d'instructions : les réponses en cache en dépendent. */
export const VERSION_PROMPT = 3;

export interface Message {
  readonly role: 'system' | 'user';
  readonly content: string;
}

const INSTRUCTIONS = [
  "Tu lis le texte d'une annonce immobilière française et tu en extrais des informations factuelles.",
  `Réponds uniquement par un objet JSON, sans commentaire ni texte autour, avec exactement ces clés : ${NOMS_CHAMPS.join(', ')}.`,
  "Une information absente du texte vaut null. N'invente rien, ne calcule rien, ne déduis rien.",
  'Nombres sans unité ni séparateur de milliers.',
  'prix : prix de vente total en euros (frais d’agence inclus si précisé). surface : en m² (loi Carrez si précisée). pieces et chambres : nombres entiers.',
  'etage : numéro d’étage (0 pour un rez-de-chaussée). ascenseur, meuble, travaux (travaux à prévoir), coproEnProcedure (copropriété en procédure ou en difficulté) : true, false ou null.',
  'dpe et ges : une lettre de A à G. codePostal : 5 chiffres. ville : nom de la commune. annee : année de construction.',
  'chargesCoproMois : charges de copropriété par mois (divise par 12 si elles sont annuelles). taxeFonciere : par an. honorairesAgence : en euros, seulement s’ils sont à la charge de l’acquéreur.',
  'loyerActuel : loyer mensuel hors charges si le bien est actuellement loué. lotsCopro : nombre de lots de la copropriété. chauffage : "individuel" ou "collectif".',
  'etat : "a_renover" (à rénover, travaux à prévoir), "a_rafraichir", "bon_etat" ou "renove" (rénové, refait à neuf), seulement si le texte le dit. exterieur : true s’il y a un balcon, une terrasse ou une loggia, false si le texte dit qu’il n’y en a pas.',
  'typeLocation : la location que l’annonce décrit ou propose, seulement si le texte le dit : "colocation" (colocation, chambres louées séparément), "courte_duree" (location saisonnière, Airbnb, meublé de tourisme, idéal location courte durée), "moyenne_duree" (bail mobilité, location de quelques mois), "meuble" (loué meublé, location meublée à l’année), "nu" (loué vide ou non meublé). Sinon null.',
].join('\n');

/** Espaces et sauts de ligne ramenés à un seul espace : même texte, même empreinte de cache. */
export function normaliserTexte(texte: string): string {
  return texte.replace(/\s+/g, ' ').trim();
}

export function messagesPour(texte: string): readonly Message[] {
  return [
    { role: 'system', content: INSTRUCTIONS },
    { role: 'user', content: texte },
  ];
}
