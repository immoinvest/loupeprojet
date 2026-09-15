import {
  calculerProjet,
  projetExemple,
  type AxeVerdict,
  type Feu,
  type FeuVerdict,
  type ProjetEntree,
  type ResultatsComplets,
} from '@loupe/moteur';

import { eurosParMois, nombre, pourcentage, pourcentageSigne } from './formatage';

type Projet = ResultatsComplets['projet'];

export const LIBELLES_AXES: Readonly<Record<AxeVerdict, string>> = {
  prix: 'Prix face aux ventes réelles',
  rendement: 'Rendement net',
  cashflow: 'Cash-flow avant impôt',
  couverture: 'Crédit ÷ loyer',
  risques: 'Risques de l’adresse',
};

export const ETATS_FEU: Readonly<Record<Feu, string>> = {
  bon: 'bon',
  surveiller: 'à surveiller',
  probleme: 'problème',
  inconnu: 'inconnu',
};

const TYPES_BIEN: Readonly<Record<Projet['bien']['type'], string>> = {
  appartement: 'Appartement',
  maison: 'Maison',
};

const MODES: Readonly<Record<Projet['hypotheses']['location']['mode'], string>> = {
  nu: 'Location nue',
  meuble: 'Location meublée',
  colocation: 'Colocation',
  courte_duree: 'Location courte durée',
  moyenne_duree: 'Bail mobilité',
};

const REGIMES: Readonly<Record<ResultatsComplets['fiscalite']['retenu'], string>> = {
  micro_bic: 'meublé micro-BIC',
  lmnp_reel: 'meublé au réel',
  micro_foncier: 'nu micro-foncier',
  nu_reel: 'nu au réel',
};

/** Valeur d'un feu, écrite comme dans l'application : « −4 % », « 5,3 % », « +46 €/mois », « 88 % », « 1 signal ». */
export function valeurFeu(feu: FeuVerdict): string {
  if (feu.valeur === null) return 'inconnu';
  switch (feu.axe) {
    case 'prix':
      return pourcentageSigne(feu.valeur);
    case 'rendement':
      return pourcentage(feu.valeur);
    case 'cashflow':
      return eurosParMois(feu.valeur);
    case 'couverture':
      return pourcentage(feu.valeur, 0);
    case 'risques':
      if (feu.valeur === 0) return 'aucun';
      return `${nombre(feu.valeur)} ${feu.valeur === 1 ? 'signal' : 'signaux'}`;
  }
}

export interface LigneFeu {
  readonly etat: Feu;
  readonly libelle: string;
  readonly valeur: string;
  readonly texteEtat: string;
}

export interface CarteExemple {
  readonly titre: string;
  readonly sousTitre: string;
  /** Le cash-flow du feu, en grand : le même chiffre que la ligne « Cash-flow avant impôt ». */
  readonly montant: string;
  readonly montantLibelle: string;
  readonly feux: readonly LigneFeu[];
  readonly note: string;
}

/**
 * Le rapport d'exemple de l'accueil, calculé par le moteur sur son projet d'exemple : aucun chiffre
 * écrit à la main, donc jamais de contradiction avec l'application.
 */
export function carteExemple(
  entree: ProjetEntree = projetExemple,
  lieu = 'Marseille 5e',
): CarteExemple {
  const resultats = calculerProjet(entree, { avecScenarios: false });
  if (!resultats.complet) throw new Error("Le projet d'exemple de l'accueil doit avoir un loyer");
  const { bien, hypotheses } = resultats.projet;
  const regime = resultats.fiscalite.retenu;
  return {
    titre: `${TYPES_BIEN[bien.type]} · ${nombre(bien.surface)} m² · ${lieu}`,
    sousTitre: `${MODES[hypotheses.location.mode]} · prêt sur ${nombre(hypotheses.pret.dureeAnnees)} ans`,
    montant: eurosParMois(resultats.fiscalite.regimes[regime].cashflow.mensuel),
    montantLibelle: `de cash-flow avant impôt, ${REGIMES[regime]}`,
    feux: resultats.verdict.feux.map((feu) => ({
      etat: feu.feu,
      libelle: LIBELLES_AXES[feu.axe],
      valeur: valeurFeu(feu),
      texteEtat: ETATS_FEU[feu.feu],
    })),
    note: `Projet d’exemple calculé par le moteur Deklic, règles de ${resultats.meta.versionRegles}.`,
  };
}
