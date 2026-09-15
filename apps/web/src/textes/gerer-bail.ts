import {
  SOURCE_IRL,
  type AlerteConformite,
  type ClasseDpe,
  type ContenuLettreRevision,
  type FormeBail,
  type PropositionProposee,
  type PropositionRevision,
} from '@loupe/gestion';

import type { Provenance } from '@/gestion/bail/vue';
import type { CodeErreurBail } from '@/gestion/bail/types';
import { dateEnLettres, moisEnLettres, montant } from '@/gestion/format';

import { de } from './gerer-ecrans';
import { nomsDesLocataires } from './gerer-loyers';

/** Textes de la vie du bail : cartes Conformité et Révision du loyer (tutoiement, comme Gérer). */
export const TEXTES_CONFORMITE = {
  titre: 'Conformité',
  dpe: 'DPE',
  zoneTendue: 'Zone tendue',
  modifier: 'Modifier le DPE',
  formulaire: 'Modifier la conformité',
  classe: 'Classe du DPE',
  dateDpe: 'Date du DPE',
  zone: 'Commune en zone tendue',
  jeNeSaisPas: 'Je ne sais pas',
  oui: 'Oui',
  non: 'Non',
  enregistrer: 'Enregistrer',
  fermer: 'Fermer',
  erreurDate: 'Indique une date valide, ou laisse le champ vide.',
  alertes: 'Points de conformité',
  rienASignaler: 'Rien à signaler.',
  sources:
    'Sources : loi du 6 juillet 1989 (articles 6 et 17-1), ministère de la Transition écologique.',
  aSuivre: 'Un projet de loi en discussion pourrait assouplir ce calendrier : Deklic suivra.',
} as const;

export const TEXTES_BAIL = {
  chargement: 'Chargement…',
  indisponible: 'Bientôt disponible : le DPE et la révision du loyer arrivent dans Gérer.',
} as const;

export const TEXTES_REVISION = {
  titre: 'Révision du loyer',
  appliquer: 'Appliquer la révision',
  reglages: 'Réglages',
  formulaire: 'Réglages de la révision',
  active: 'Révision annuelle',
  activeOui: 'Oui, chaque année',
  activeNon: 'Non',
  anniversaire: 'Date anniversaire',
  trimestre: 'Trimestre de référence de l’IRL',
  forme: 'Forme du bail',
  enregistrer: 'Enregistrer',
  fermer: 'Fermer',
  erreurDate: 'Indique une date anniversaire valide.',
  voirLettre: 'Voir la lettre de révision',
  derniereLettre: 'Dernière lettre de révision',
  source: 'Source : INSEE',
  bailleurAvant: 'Pour écrire la lettre, Deklic a besoin de ton nom et de ton adresse de bailleur.',
} as const;

export const PROVENANCES: Readonly<Record<Provenance, string>> = {
  saisie: 'à toi',
  analyse: 'analyse',
  par_defaut: 'par défaut',
  aucune: 'inconnu',
};

export const FORMES_BAIL_TEXTES: Readonly<Record<FormeBail, string>> = {
  classique: 'Bail classique',
  etudiant: 'Bail étudiant (9 mois)',
  mobilite: 'Bail mobilité (1 à 10 mois)',
};

export const ERREURS_BAIL: Readonly<Record<CodeErreurBail, string>> = {
  non_connecte: 'Ta session a expiré. Reconnecte-toi.',
  invalide: 'Une information est invalide. Vérifie les champs.',
  introuvable: 'Cet élément n’existe plus. Recharge la page.',
  revision_impossible: 'Cette révision n’est plus proposée. Recharge la page.',
  bailleur_manquant: 'Indique d’abord ton nom et ton adresse de bailleur.',
  periode_payee: 'Le mois du nouveau loyer a déjà reçu un paiement. Recharge la page.',
  hors_location: 'Le nouveau loyer tomberait après la fin de la location : pas de révision.',
  limite: 'Cette location a atteint le nombre maximal de changements de loyer.',
  indisponible: TEXTES_BAIL.indisponible,
  reseau: 'Impossible de joindre Deklic. Vérifie ta connexion internet.',
  inconnue: 'Quelque chose n’a pas marché. Réessaie.',
};

/** « Classe D, réalisé le 1er mars 2024 », « Classe D », « Non renseigné ». */
export function dpeEnLettres(classe: ClasseDpe | null, date: string | null): string {
  if (classe === null) return 'Non renseigné';
  return date === null ? `Classe ${classe}` : `Classe ${classe}, réalisé le ${dateEnLettres(date)}`;
}

export function zoneEnLettres(zone: boolean | null): string {
  if (zone === null) return 'Non renseignée';
  return zone ? 'Oui' : 'Non';
}

const FORMES_COURTES: Readonly<Record<Exclude<FormeBail, 'classique'>, string>> = {
  etudiant: 'étudiant',
  mobilite: 'mobilité',
};

/** La phrase d'une alerte, sur la fiche du bien. */
export function alerteEnLettres(alerte: AlerteConformite): string {
  switch (alerte.code) {
    case 'location_interdite':
      return `Classe ${alerte.classe} : nouveau bail et renouvellement interdits depuis le ${dateEnLettres(alerte.depuis)}.`;
    case 'location_interdite_bientot':
      return `Classe ${alerte.classe} : nouveau bail et renouvellement interdits à partir du ${dateEnLettres(alerte.aPartirDu)}.`;
    case 'dpe_perime':
      return `DPE plus valable depuis le ${dateEnLettres(alerte.depuis)} : fais-en réaliser un nouveau avant de relouer.`;
    case 'dpe_manquant':
      return 'DPE non renseigné : ajoute sa classe pour vérifier la location et la révision.';
    case 'fin_bail_court':
      return `Bail ${FORMES_COURTES[alerte.forme]} : fin prévue le ${dateEnLettres(alerte.fin)}.`;
  }
}

/** La ligne d'une alerte urgente dans « À faire ». */
export function alerteAFaire(alerte: AlerteConformite, bien: string): string {
  switch (alerte.code) {
    case 'location_interdite':
      return `Location interdite : ${bien} (DPE ${alerte.classe})`;
    case 'dpe_perime':
      return `DPE à refaire : ${bien}`;
    case 'fin_bail_court':
      return `Fin du bail ${FORMES_COURTES[alerte.forme]} le ${dateEnLettres(alerte.fin)} : ${bien}`;
    case 'location_interdite_bientot':
    case 'dpe_manquant':
      return alerteEnLettres(alerte);
  }
}

/** « 2026-T2 » → « 2e trimestre 2026 » ; « 2026-T1 » → « 1er trimestre 2026 ». */
export function trimestreEnLettres(trimestre: string): string {
  const numero = trimestre.slice(6);
  return `${numero === '1' ? '1er' : `${numero}e`} trimestre ${trimestre.slice(0, 4)}`;
}

/** 14 837 → « 148,37 ». */
export function indiceEnLettres(valeur: number): string {
  return (valeur / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Entre le nombre et « % », comme le fait `Intl` pour « € ». */
const ESPACE_INSECABLE = String.fromCharCode(160);

/** 1,15 → « +1,15 % ». */
export function variationEnLettres(pourcent: number): string {
  const texte = pourcent.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `+${texte}${ESPACE_INSECABLE}%`;
}

/** « 650 € → 657,49 € (+1,15 %) ». */
export function nouveauLoyerEnLettres(p: PropositionProposee): string {
  return `${montant(p.loyerActuel)} → ${montant(p.nouveauLoyer)} (${variationEnLettres(p.variationPourcent)})`;
}

/** « à partir d’octobre 2026 ». */
export function aPartirDuMois(periode: string): string {
  return `à partir ${de(moisEnLettres(periode))}`;
}

/** « Loyer hors charges, à partir d’octobre 2026 (anniversaire du bail le 1er octobre 2026). » */
export function effetEnLettres(p: PropositionProposee): string {
  return `Loyer hors charges, ${aPartirDuMois(p.aPartirDe)} (anniversaire du bail le ${dateEnLettres(p.anniversaire)}).`;
}

/** « IRL du 2e trimestre 2026 : 148,37 (publié le 10 juillet 2026), contre 146,68 un an plus tôt. » */
export function indicesEnLettres(p: PropositionProposee): string {
  const { indiceAncien: a, indiceNouveau: n } = p;
  return `IRL du ${trimestreEnLettres(n.trimestre)} : ${indiceEnLettres(n.valeur)} (publié le ${dateEnLettres(n.publieLe)}), contre ${indiceEnLettres(a.valeur)} un an plus tôt.`;
}

export const URL_SOURCE_IRL = SOURCE_IRL.url;

/** La phrase de la carte quand aucune hausse n'est à appliquer. */
export function phraseRevision(p: Exclude<PropositionRevision, PropositionProposee>): string {
  switch (p.statut) {
    case 'inactive':
      return 'Révision désactivée pour cette location.';
    case 'terminee':
      return 'Location terminée : plus de révision.';
    case 'pas_encore':
      return `Prochaine révision le ${dateEnLettres(p.prochaine)} : Deklic la proposera un mois avant.`;
    case 'appliquee':
      return `Révision du ${dateEnLettres(p.anniversaire)} appliquée. Prochaine : ${dateEnLettres(p.prochaine)}.`;
    case 'gelee':
      return `Loyer gelé : logement classé ${p.classe}. La loi interdit toute hausse (loi du 6 juillet 1989, article 17-1).`;
    case 'indice_attendu':
      return `L’indice du ${trimestreEnLettres(p.trimestre)} n’est pas encore dans Deklic (publication prévue vers le ${dateEnLettres(p.publicationPrevue)}). La révision attendra.`;
    case 'reference_inconnue':
      return 'Trimestre de référence trop ancien : choisis-le dans les réglages.';
    case 'sans_hausse':
      return 'L’indice n’a pas augmenté sur un an : pas de hausse cette année.';
  }
}

/** « Révision appliquée : 657,49 € à partir d’octobre 2026. » */
export function revisionAppliquee(nouveauLoyer: number, aPartirDe: string): string {
  return `Révision appliquée : ${montant(nouveauLoyer)} ${aPartirDuMois(aPartirDe)}.`;
}

/** « Réviser le loyer de Julie : 650 € → 657,49 € ». */
export function revisionAFaire(prenom: string, p: PropositionProposee): string {
  return `Réviser le loyer ${de(prenom)} : ${montant(p.loyerActuel)} → ${montant(p.nouveauLoyer)}`;
}

/** Textes de la lettre de révision : elle s'adresse au locataire, sans tutoiement. */
export const TEXTES_LETTRE = {
  titre: 'Révision annuelle du loyer',
  bailleur: 'Bailleur',
  logement: 'Logement loué',
  salutation: 'Madame, Monsieur,',
  loyerActuel: 'Loyer hors charges actuel',
  variation: 'Variation de l’indice',
  nouveauLoyer: 'Nouveau loyer hors charges',
  charges: 'Charges (inchangées)',
  nouveauTotal: 'Nouveau total mensuel',
  imprimer: 'Imprimer ou enregistrer en PDF',
  apercu:
    'Aperçu de la lettre. Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ».',
  chargement: 'Chargement de la lettre…',
  introuvable: 'Lettre introuvable',
  introuvableTexte: 'Cette lettre n’existe pas, ou elle appartient à un autre compte.',
  formule: 'Veuillez agréer, Madame, Monsieur, l’expression de mes salutations distinguées.',
} as const;

export function lettreIntroduction(c: ContenuLettreRevision): string {
  return `Conformément à la clause de révision de votre bail et à l’article 17-1 de la loi n° 89-462 du 6 juillet 1989, le loyer hors charges du logement que vous louez est révisé à la date anniversaire du ${dateEnLettres(c.anniversaire)}, selon la variation de l’indice de référence des loyers publié par l’INSEE.`;
}

/** « IRL de référence (2e trimestre 2025) ». */
export function lettreIndice(trimestre: string, reference: boolean): string {
  return reference
    ? `IRL de référence (${trimestreEnLettres(trimestre)})`
    : `IRL du ${trimestreEnLettres(trimestre)}`;
}

/** « 650 € × 148,37 ÷ 146,68 = 657,49 €. » */
export function lettreCalcul(c: ContenuLettreRevision): string {
  return `Calcul : ${montant(c.loyerActuel)} × ${indiceEnLettres(c.indiceNouveau.valeur)} ÷ ${indiceEnLettres(c.indiceAncien.valeur)} = ${montant(c.nouveauLoyer)}.`;
}

export function lettreEffet(c: ContenuLettreRevision): string {
  const noms = nomsDesLocataires(c.locataires.map((l) => `${l.prenom} ${l.nom}`));
  return `Ce nouveau loyer s’applique ${aPartirDuMois(c.aPartirDe)}, sans effet rétroactif. Il concerne le bail de ${noms}.`;
}

export function lettreSource(c: ContenuLettreRevision): string {
  return `Indice publié par l’INSEE le ${dateEnLettres(c.indiceNouveau.publieLe)} (${SOURCE_IRL.url}).`;
}

export function lettreFaitLe(jour: string): string {
  return `Fait le ${dateEnLettres(jour)}.`;
}

export function numeroLettreEnLettres(numero: string): string {
  return `N° ${numero}`;
}
