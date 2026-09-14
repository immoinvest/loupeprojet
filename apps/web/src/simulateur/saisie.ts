import {
  OffrePretSchema,
  ProjetFinanceSchema,
  VERSION_REGLES_COURANTE,
  arrondirEuro,
  fraisNotaireEstimes,
  type OffrePret,
  type ProjetFinance,
  type Regles,
  type SimulationPret,
} from '@loupe/moteur';
import type { z } from 'zod';

import { depuisTexte, versTexte, type Descripteur } from '@/hypotheses';

import { CHAMPS_OFFRE, CHAMPS_PROJET, type CleOffre, type CleProjet } from './descripteurs';

/** Ce que la personne a tapé, champ par champ ; l'offre B peut être absente. */
export type TextesProjet = Readonly<Record<CleProjet, string>>;
export type TextesOffre = Readonly<Record<CleOffre, string>>;
export interface Saisie {
  readonly projet: TextesProjet;
  readonly offres: readonly [TextesOffre, TextesOffre | null];
}

export type Colonne = 'projet' | 'a' | 'b';

/** Noms affichés quand le champ « Banque » est vide. */
export const NOMS_OFFRES: readonly [string, string] = ['Offre A', 'Offre B'];

export const PRIX_DEFAUT = 150_000;
const DUREE_DEFAUT_ANNEES = 20;

/** Erreurs par champ, clé « projet.prix », « a.tauxNominal », « b.differeTotalMois ». */
export type Erreurs = Readonly<Record<string, string>>;

export interface Conversion {
  readonly projet: ProjetFinance | null;
  readonly offres: readonly [OffrePret | null, OffrePret | null];
  readonly erreurs: Erreurs;
  /** Présente dès que le projet et l'offre A sont valides (et l'offre B, si elle existe). */
  readonly simulation: SimulationPret | null;
}

const OBLIGATOIRE = 'Cette valeur est nécessaire au calcul.';

/** Le nom affiché d'une offre : le champ « Banque », ou « Offre A » / « Offre B » s'il est vide. */
export function nomOffre(nom: string, index: 0 | 1): string {
  const propre = nom.trim();
  return propre === '' ? NOMS_OFFRES[index] : propre;
}

function textesOffre(offre: OffrePret): TextesOffre {
  return Object.fromEntries(
    CHAMPS_OFFRE.map((d) => [d.chemin, versTexte(offre[d.chemin], d.type)]),
  ) as TextesOffre;
}

/** Une offre au taux moyen sur 20 ans des règles, sans apport ni frais. */
export function offreDefaut(regles: Regles): TextesOffre {
  return textesOffre(
    OffrePretSchema.parse({
      tauxNominal: regles.credit.tauxMoyens['20'],
      dureeAnnees: DUREE_DEFAUT_ANNEES,
    }),
  );
}

/**
 * Texte des frais de notaire estimés pour ces textes de prix, honoraires et département ;
 * `null` quand le prix ou les honoraires sont illisibles ou le prix vide.
 */
export function estimerFraisNotaire(projet: TextesProjet, regles: Regles): string | null {
  const prix = depuisTexte(projet.prix, 'euros');
  const honoraires = depuisTexte(projet.honorairesAgence, 'euros');
  if (!prix.ok || !honoraires.ok || typeof prix.valeur !== 'number') return null;
  const departement = projet.departement.trim();
  const frais = fraisNotaireEstimes(
    prix.valeur,
    typeof honoraires.valeur === 'number' ? honoraires.valeur : 0,
    departement === '' ? undefined : departement,
    regles,
  );
  return String(arrondirEuro(frais));
}

/** Les frais de notaire sont « à toi » dès qu'ils ne sont plus ceux de l'estimation. */
export function fraisNotaireManuels(projet: TextesProjet, regles: Regles): boolean {
  const estimation = estimerFraisNotaire(projet, regles);
  return estimation !== null && projet.fraisNotaire.trim() !== estimation;
}

export function saisieDefaut(regles: Regles): Saisie {
  const offre = offreDefaut(regles);
  const sansFrais: Saisie = {
    projet: {
      prix: String(PRIX_DEFAUT),
      honorairesAgence: '0',
      travaux: '0',
      fraisNotaire: '',
      departement: '',
      revenusMensuels: '',
    },
    offres: [offre, { ...offre }],
  };
  return reestimerFraisNotaire(sansFrais, regles);
}

/** Une simulation validée (lien, stockage local) → textes des champs. */
export function saisieDepuisSimulation(simulation: SimulationPret): Saisie {
  const projet = Object.fromEntries(
    CHAMPS_PROJET.map((d) => [d.chemin, versTexte(simulation.projet[d.chemin], d.type)]),
  ) as TextesProjet;
  const [a, b] = simulation.offres.map(textesOffre);
  // Le schéma exige au moins une offre ; le typage du tableau ne le sait pas.
  if (a === undefined) throw new Error('Simulation sans offre');
  return { projet, offres: [a, b ?? null] };
}

/** Prix, honoraires et département entraînent les frais de notaire tant qu'ils sont estimés. */
const ENTRAINENT_LES_FRAIS: ReadonlySet<string> = new Set([
  'prix',
  'honorairesAgence',
  'departement',
]);

function avecOffre(saisie: Saisie, index: 0 | 1, offre: TextesOffre): Saisie {
  return {
    ...saisie,
    offres: index === 0 ? [offre, saisie.offres[1]] : [saisie.offres[0], offre],
  };
}

/** Applique un texte saisi ; ré-estime les frais de notaire s'ils suivaient l'estimation. */
export function appliquerTexte(
  saisie: Saisie,
  regles: Regles,
  colonne: Colonne,
  cle: string,
  texte: string,
): Saisie {
  if (colonne === 'projet') {
    const suivant: TextesProjet = { ...saisie.projet, [cle]: texte };
    const suivre = ENTRAINENT_LES_FRAIS.has(cle) && !fraisNotaireManuels(saisie.projet, regles);
    if (!suivre) return { ...saisie, projet: suivant };
    return {
      ...saisie,
      projet: { ...suivant, fraisNotaire: estimerFraisNotaire(suivant, regles) ?? '' },
    };
  }
  const index = colonne === 'a' ? 0 : 1;
  const offre = saisie.offres[index];
  return offre === null ? saisie : avecOffre(saisie, index, { ...offre, [cle]: texte });
}

/** Remet les frais de notaire à l'estimation (bouton « Ré-estimer »). */
export function reestimerFraisNotaire(saisie: Saisie, regles: Regles): Saisie {
  const estimation = estimerFraisNotaire(saisie.projet, regles);
  return estimation === null
    ? saisie
    : { ...saisie, projet: { ...saisie.projet, fraisNotaire: estimation } };
}

export function retirerOffreB(saisie: Saisie): Saisie {
  return { ...saisie, offres: [saisie.offres[0], null] };
}

/** Ajoute une offre B copiée sur A, sans son nom. */
export function ajouterOffreB(saisie: Saisie): Saisie {
  return { ...saisie, offres: [saisie.offres[0], { ...saisie.offres[0], nom: '' }] };
}

interface Lecture {
  readonly valeurs: Record<string, unknown>;
  readonly erreurs: Record<string, string>;
}

/** Textes → valeurs, une erreur par champ illisible ou obligatoire vide. */
function lire<K extends string>(
  champs: readonly (Descripteur & { readonly chemin: K })[],
  textes: Readonly<Record<K, string>>,
  prefixe: string,
): Lecture {
  const valeurs: Record<string, unknown> = {};
  const erreurs: Record<string, string> = {};
  for (const d of champs) {
    const conversion = depuisTexte(textes[d.chemin], d.type);
    if (!conversion.ok) erreurs[`${prefixe}.${d.chemin}`] = conversion.erreur;
    else if (conversion.valeur === undefined && d.obligatoire === true) {
      erreurs[`${prefixe}.${d.chemin}`] = OBLIGATOIRE;
    } else if (conversion.valeur !== undefined) valeurs[d.chemin] = conversion.valeur;
  }
  return { valeurs, erreurs };
}

/** Valide par Zod et range chaque problème sous son champ. */
function valider<S extends z.ZodType>(
  schema: S,
  lecture: Lecture,
  prefixe: string,
  erreurs: Record<string, string>,
): z.output<S> | null {
  Object.assign(erreurs, lecture.erreurs);
  if (Object.keys(lecture.erreurs).length > 0) return null;
  const resultat = schema.safeParse(lecture.valeurs);
  if (resultat.success) return resultat.data;
  for (const issue of resultat.error.issues) {
    erreurs[`${prefixe}.${issue.path.map(String).join('.')}`] = issue.message;
  }
  return null;
}

function lireOffre(
  textes: TextesOffre,
  index: 0 | 1,
  erreurs: Record<string, string>,
): OffrePret | null {
  const prefixe = index === 0 ? 'a' : 'b';
  const lecture = lire(CHAMPS_OFFRE, textes, prefixe);
  lecture.valeurs.nom = nomOffre(textes.nom, index);
  return valider(OffrePretSchema, lecture, prefixe, erreurs);
}

/** Chaque carte est validée séparément : A se calcule même si seule B est fausse. */
export function versSimulation(saisie: Saisie): Conversion {
  const erreurs: Record<string, string> = {};
  const projet = valider(
    ProjetFinanceSchema,
    lire(CHAMPS_PROJET, saisie.projet, 'projet'),
    'projet',
    erreurs,
  );
  const a = lireOffre(saisie.offres[0], 0, erreurs);
  const b = saisie.offres[1] === null ? null : lireOffre(saisie.offres[1], 1, erreurs);
  const complete = saisie.offres[1] === null || b !== null;
  return {
    projet,
    offres: [a, b],
    erreurs,
    simulation:
      projet !== null && a !== null && complete
        ? { versionRegles: VERSION_REGLES_COURANTE, projet, offres: b === null ? [a] : [a, b] }
        : null,
  };
}
