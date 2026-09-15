import { obtenirRegles } from '../regles';
import type { ClasseEnergie } from '../schema/bien';
import type { Projet } from '../schema/projet';
import type { AxeVerdict, Feu, FeuVerdict } from '../verdict/feux';
import type { ContexteVisite, ParametresQuestion, PredicatVisite, TypeExploitation } from './types';

/** Le type d'exploitation de la visite, un pour chacun des cinq modes de location (fiche 05). */
export function typeExploitation(projet: Projet): TypeExploitation {
  switch (projet.hypotheses.location.mode) {
    case 'nu':
      return 'nue';
    case 'meuble':
      return 'meublee';
    case 'colocation':
      return 'colocation';
    case 'courte_duree':
      return 'courte_duree';
    case 'moyenne_duree':
      return 'moyenne_duree';
  }
}

export function contexteVisite(projet: Projet, feux: readonly FeuVerdict[]): ContexteVisite {
  const regles = obtenirRegles(projet.versionRegles);
  return {
    projet,
    exploitation: typeExploitation(projet),
    feux,
    regles,
    anneeReference: Number(regles.dateReference.slice(0, 4)),
  };
}

/* Prédicats sur le bien. */

export const copro: PredicatVisite = (c) => c.projet.bien.copro !== undefined;
export const coproEnProcedure: PredicatVisite = (c) => c.projet.bien.copro?.procedure === true;
export const lotsInconnus: PredicatVisite = (c) =>
  c.projet.bien.copro !== undefined && c.projet.bien.copro.lots === undefined;
export const maison: PredicatVisite = (c) => c.projet.bien.type === 'maison';
export const appartement: PredicatVisite = (c) => c.projet.bien.type === 'appartement';
export const anneeInconnue: PredicatVisite = (c) => c.projet.bien.annee === undefined;

/** Année de construction connue et antérieure au seuil daté de la règle. */
export function construitAvant(seuil: 'amianteAvantAnnee' | 'plombAvantAnnee'): PredicatVisite {
  return (c) => {
    const annee = c.projet.bien.annee;
    return annee !== undefined && annee < c.regles.visite[seuil];
  };
}

/** Installations de plus de quinze ans, ou d'âge inconnu : les diagnostics sont à demander. */
export const installationsAnciennes: PredicatVisite = (c) => {
  const annee = c.projet.bien.annee;
  return (
    annee === undefined || annee <= c.anneeReference - c.regles.visite.installationsAnciennesAns
  );
};

export const dpeInconnu: PredicatVisite = (c) => c.projet.bien.dpe === undefined;
export function dpeParmi(...classes: readonly ClasseEnergie[]): PredicatVisite {
  return (c) => c.projet.bien.dpe !== undefined && classes.includes(c.projet.bien.dpe);
}

export const etageEleveSansAscenseur: PredicatVisite = (c) => {
  const { etage, ascenseur } = c.projet.bien;
  return etage !== undefined && etage >= c.regles.visite.etageSansAscenseur && ascenseur === false;
};
export const rezDeChaussee: PredicatVisite = (c) =>
  c.projet.bien.etage !== undefined && c.projet.bien.etage <= 0;
export const avecAscenseur: PredicatVisite = (c) => c.projet.bien.ascenseur === true;
export const avecExterieur: PredicatVisite = (c) => c.projet.bien.exterieur === true;

/* Prédicats sur l'exploitation, le marché, l'achat et le verdict. */

export function exploitationParmi(...types: readonly TypeExploitation[]): PredicatVisite {
  return (c) => types.includes(c.exploitation);
}
export const meuble: PredicatVisite = exploitationParmi(
  'meublee',
  'colocation',
  'courte_duree',
  'moyenne_duree',
);

export const travauxPrevus: PredicatVisite = (c) =>
  c.projet.hypotheses.achat.travaux > 0 ||
  c.projet.bien.etat === 'a_renover' ||
  c.projet.bien.etat === 'a_rafraichir';
/** Le montant des travaux vient de l'estimation selon l'état (pas d'un devis ni d'une saisie). */
export const travauxEstimes: PredicatVisite = (c) => {
  const { travaux, travauxChoix } = c.projet.hypotheses.achat;
  return travaux > 0 && travauxChoix !== undefined && travauxChoix !== 'saisi';
};
export const honorairesAgence: PredicatVisite = (c) =>
  c.projet.hypotheses.achat.honorairesAgence > 0;
export const loyerEncadre: PredicatVisite = (c) =>
  c.projet.marche.plafondLoyerMensuel !== undefined;

/** Types des risques de niveau moyen ou fort à l'adresse. */
export function risquesSignales(c: ContexteVisite): readonly string[] {
  return c.projet.marche.risques.filter((r) => r.niveau !== 'faible').map((r) => r.type);
}
export const enZoneARisque: PredicatVisite = (c) => risquesSignales(c).length > 0;

export function feu(axe: AxeVerdict, etat: Feu): PredicatVisite {
  return (c) => c.feux.some((f) => f.axe === axe && f.feu === etat);
}

/* Combinaisons. */

export function tous(...predicats: readonly PredicatVisite[]): PredicatVisite {
  return (c) => predicats.every((p) => p(c));
}
export function non(predicat: PredicatVisite): PredicatVisite {
  return (c) => !predicat(c);
}

/* Paramètres partagés par plusieurs questions. */

export const parametreDpe = (c: ContexteVisite): ParametresQuestion => ({
  dpe: c.projet.bien.dpe ?? '',
});
export const parametreAnnee = (c: ContexteVisite): ParametresQuestion => ({
  annee: c.projet.bien.annee ?? 0,
});
export const parametreEtage = (c: ContexteVisite): ParametresQuestion => ({
  etage: c.projet.bien.etage ?? 0,
});
export const parametreChambreM2 = (c: ContexteVisite): ParametresQuestion => ({
  chambreM2: c.regles.visite.chambreColocationM2,
});
/** Écart du prix affiché aux ventes comparables, en décimal (formaté en pourcentage par l'interface). */
export const parametreEcartPrix = (c: ContexteVisite): ParametresQuestion => ({
  ecart: c.feux.find((f) => f.axe === 'prix')?.valeur ?? 0,
});
