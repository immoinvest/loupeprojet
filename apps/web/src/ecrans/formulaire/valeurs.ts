import {
  JOURS_PAR_MOIS,
  VERSION_REGLES_COURANTE,
  obtenirRegles,
  type ClasseEnergie,
  type EtatBien,
  type ModeLocation,
  type TypeBien,
} from '@loupe/moteur';

import type { AnnonceResolue, ChampsExtraits, Provenance, SaisieProjet } from '@/annonces';

export type Cle =
  | 'typeBien'
  | 'ges'
  | 'lotsCopro'
  | 'coproEnProcedure'
  | 'prix'
  | 'honorairesAgence'
  | 'surface'
  | 'pieces'
  | 'chambres'
  | 'etage'
  | 'ascenseur'
  | 'annee'
  | 'dpe'
  | 'etat'
  | 'exterieur'
  | 'codePostal'
  | 'ville'
  | 'chargesCoproMois'
  | 'taxeFonciere'
  | 'travaux'
  | 'mode'
  | 'loyerHc'
  | 'chambresLouees'
  | 'loyerChambre'
  | 'nuitee'
  | 'nuiteesParMois'
  | 'apport'
  | 'dureeAnnees'
  | 'tmi'
  | 'revenusMensuels';

export type Valeurs = Readonly<Record<Cle, string>>;
export type ProvenanceValeurs = Partial<Record<Cle, Provenance>>;
export type Erreurs = Partial<Record<Cle, string>>;

export interface ValeursInitiales {
  readonly valeurs: Valeurs;
  readonly provenance: ProvenanceValeurs;
}

const VIDE: Valeurs = {
  typeBien: 'appartement',
  ges: '',
  lotsCopro: '',
  coproEnProcedure: '',
  prix: '',
  honorairesAgence: '',
  surface: '',
  pieces: '',
  chambres: '',
  etage: '',
  ascenseur: '',
  annee: '',
  dpe: '',
  etat: '',
  exterieur: '',
  codePostal: '',
  ville: '',
  chargesCoproMois: '',
  taxeFonciere: '',
  travaux: '',
  mode: 'meuble',
  loyerHc: '',
  chambresLouees: '',
  loyerChambre: '',
  nuitee: '',
  nuiteesParMois: '',
  apport: '',
  dureeAnnees: '25',
  tmi: '0.3',
  revenusMensuels: '',
};

/** Les champs de loyer demandés par chaque type d'exploitation. */
export const CHAMPS_LOYER: Readonly<Record<ModeLocation, readonly Cle[]>> = {
  nu: ['loyerHc'],
  meuble: ['loyerHc'],
  moyenne_duree: ['loyerHc'],
  colocation: ['chambresLouees', 'loyerChambre'],
  courte_duree: ['nuitee', 'nuiteesParMois'],
};

/**
 * Pré-remplit depuis l'extraction ; chaque champ trouvé porte la provenance « annonce ».
 * Le type de location lu (ou « meublé » quand seule la mention existe) choisit le type du formulaire.
 */
export function valeursDepuisChamps(champs: ChampsExtraits): ValeursInitiales {
  const valeurs: Record<Cle, string> = { ...VIDE };
  const provenance: ProvenanceValeurs = {};
  const poser = (cle: Cle, v: number | string | boolean | undefined): void => {
    if (v === undefined) return;
    valeurs[cle] = typeof v === 'boolean' ? (v ? 'oui' : 'non') : String(v);
    provenance[cle] = 'annonce';
  };
  poser('typeBien', champs.typeBien);
  poser('ges', champs.ges);
  poser('lotsCopro', champs.lotsCopro);
  poser('coproEnProcedure', champs.coproEnProcedure);
  poser('prix', champs.prix);
  poser('honorairesAgence', champs.honorairesAgence);
  poser('surface', champs.surface);
  poser('pieces', champs.pieces);
  poser('chambres', champs.chambres);
  poser('etage', champs.etage);
  poser('ascenseur', champs.ascenseur);
  poser('annee', champs.annee);
  poser('dpe', champs.dpe);
  poser('etat', champs.etat);
  poser('exterieur', champs.exterieur);
  poser('codePostal', champs.codePostal);
  poser('ville', champs.ville);
  poser('chargesCoproMois', champs.chargesCoproMois);
  poser('taxeFonciere', champs.taxeFonciere);
  poser('mode', champs.mode ?? (champs.meuble === true ? 'meuble' : undefined));
  return { valeurs, provenance };
}

/** « 155 000 », « 32,5 » → nombre ; vide ou illisible → undefined. */
export function nombre(v: string): number | undefined {
  const t = v.replace(/\s/g, '').replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const MESSAGES_LOYER: Readonly<
  Record<'loyerHc' | 'chambresLouees' | 'loyerChambre' | 'nuitee' | 'nuiteesParMois', string>
> = {
  loyerHc: 'Indiquez le loyer visé, hors charges.',
  chambresLouees: 'Indiquez le nombre de chambres louées (1 à 20).',
  loyerChambre: 'Indiquez le loyer d’une chambre, hors charges.',
  nuitee: 'Indiquez le prix d’une nuit.',
  nuiteesParMois: 'Entre 0 et 31 nuits par mois.',
};

/** Les champs de loyer du type choisi, chacun avec ses bornes. */
function validerLoyer(v: Valeurs, erreurs: Erreurs): void {
  const mode = v.mode as ModeLocation;
  const bornes: Readonly<Record<keyof typeof MESSAGES_LOYER, (n: number) => boolean>> = {
    loyerHc: (n) => n >= 0,
    chambresLouees: (n) => Number.isInteger(n) && n >= 1 && n <= 20,
    loyerChambre: (n) => n >= 0,
    nuitee: (n) => n > 0,
    nuiteesParMois: (n) => n >= 0 && n <= 31,
  };
  for (const cle of CHAMPS_LOYER[mode] as readonly (keyof typeof MESSAGES_LOYER)[]) {
    const n = nombre(v[cle]);
    if (n === undefined || !bornes[cle](n)) erreurs[cle] = MESSAGES_LOYER[cle];
  }
}

export function valider(v: Valeurs): Erreurs {
  const erreurs: Erreurs = {};
  const prix = nombre(v.prix);
  if (prix === undefined || prix <= 0) erreurs.prix = 'Indiquez le prix affiché.';
  const surface = nombre(v.surface);
  if (surface === undefined || surface <= 0) erreurs.surface = 'Indiquez la surface.';
  if (!/^\d{5}$/.test(v.codePostal.trim())) erreurs.codePostal = 'Code postal à 5 chiffres.';
  if (v.ville.trim() === '') erreurs.ville = 'Indiquez la ville.';
  validerLoyer(v, erreurs);
  const apport = nombre(v.apport);
  if (apport === undefined || apport < 0) erreurs.apport = 'Indiquez votre apport (0 si aucun).';
  const revenus = nombre(v.revenusMensuels);
  if (revenus === undefined || revenus < 0) {
    erreurs.revenusMensuels = 'Indiquez vos revenus nets mensuels.';
  }
  const duree = nombre(v.dureeAnnees);
  if (duree === undefined || duree < 1 || duree > 30) erreurs.dureeAnnees = 'Entre 1 et 30 ans.';
  return erreurs;
}

/**
 * Le loyer mensuel du logement entier, pivot de `construireProjet` (taxe foncière estimée, défauts) :
 * chambres × loyer par chambre en colocation ; en courte durée, le loyer meublé que la nuitée suppose.
 */
function loyerDuLogement(v: Valeurs): number {
  switch (v.mode as ModeLocation) {
    case 'colocation':
      return (nombre(v.chambresLouees) ?? 0) * (nombre(v.loyerChambre) ?? 0);
    case 'courte_duree': {
      const { nuiteeEnLoyersJournaliers } =
        obtenirRegles(VERSION_REGLES_COURANTE).exploitation.parType.courte_duree;
      return Math.round(((nombre(v.nuitee) ?? 0) * JOURS_PAR_MOIS) / nuiteeEnLoyersJournaliers);
    }
    case 'nu':
    case 'meuble':
    case 'moyenne_duree':
      return nombre(v.loyerHc) ?? 0;
  }
}

/** Valeurs validées → saisie typée pour `construireProjet`. */
export function versSaisie(
  v: Valeurs,
  provenance: ProvenanceValeurs,
  annonce: AnnonceResolue | null,
): SaisieProjet {
  const opt = (cle: Cle): number | undefined => nombre(v[cle]);
  const mode = v.mode as ModeLocation;
  return {
    typeBien: v.typeBien as TypeBien,
    ges: v.ges === '' ? undefined : (v.ges as ClasseEnergie),
    lotsCopro: opt('lotsCopro'),
    coproEnProcedure: v.coproEnProcedure === '' ? undefined : v.coproEnProcedure === 'oui',
    prix: nombre(v.prix) ?? 0,
    honorairesAgence: opt('honorairesAgence'),
    surface: nombre(v.surface) ?? 0,
    pieces: opt('pieces'),
    chambres: opt('chambres'),
    etage: opt('etage'),
    ascenseur: v.ascenseur === '' ? undefined : v.ascenseur === 'oui',
    annee: opt('annee'),
    dpe: v.dpe === '' ? undefined : (v.dpe as ClasseEnergie),
    etat: v.etat === '' ? undefined : (v.etat as EtatBien),
    exterieur: v.exterieur === '' ? undefined : v.exterieur === 'oui',
    codePostal: v.codePostal.trim(),
    ville: v.ville.trim(),
    chargesCoproMois: opt('chargesCoproMois'),
    taxeFonciere: opt('taxeFonciere'),
    travaux: opt('travaux'),
    mode,
    loyerHc: loyerDuLogement(v),
    chambresLouees: mode === 'colocation' ? opt('chambresLouees') : undefined,
    loyerChambre: mode === 'colocation' ? opt('loyerChambre') : undefined,
    nuitee: mode === 'courte_duree' ? opt('nuitee') : undefined,
    nuiteesParMois: mode === 'courte_duree' ? opt('nuiteesParMois') : undefined,
    apport: nombre(v.apport) ?? 0,
    dureeAnnees: nombre(v.dureeAnnees) ?? 25,
    tmi: Number(v.tmi) as SaisieProjet['tmi'],
    revenusMensuels: nombre(v.revenusMensuels) ?? 0,
    provenance,
    annonce: annonce ?? undefined,
  };
}
