import {
  TMI_PAR_DEFAUT,
  type ClasseEnergie,
  type EtatBien,
  type ModeLocation,
  type TypeBien,
} from '@loupe/moteur';

import {
  APPORT_DEFAUT,
  DUREE_DEFAUT_ANNEES,
  type AnnonceResolue,
  type ChampsExtraits,
  type Provenance,
  type SaisieProjet,
} from '@/annonces';

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
  | 'apport'
  | 'dureeAnnees'
  | 'tmi';

export type Valeurs = Readonly<Record<Cle, string>>;
export type ProvenanceValeurs = Partial<Record<Cle, Provenance>>;
export type Erreurs = Partial<Record<Cle, string>>;

export interface ValeursInitiales {
  readonly valeurs: Valeurs;
  readonly provenance: ProvenanceValeurs;
}

/** Jamais de case vide : les défauts sourcés sont affichés, avec le badge « estimé ». */
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
  apport: String(APPORT_DEFAUT),
  dureeAnnees: String(DUREE_DEFAUT_ANNEES),
  tmi: String(TMI_PAR_DEFAUT),
};

const PROVENANCE_DEFAUTS: ProvenanceValeurs = {
  apport: 'estime',
  dureeAnnees: 'estime',
  tmi: 'estime',
};

/** Pré-remplit depuis l'extraction ; chaque champ trouvé porte la provenance « annonce ». */
export function valeursDepuisChamps(champs: ChampsExtraits): ValeursInitiales {
  const valeurs: Record<Cle, string> = { ...VIDE };
  const provenance: ProvenanceValeurs = { ...PROVENANCE_DEFAUTS };
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
  return { valeurs, provenance };
}

/** « 155 000 », « 32,5 » → nombre ; vide ou illisible → undefined. */
export function nombre(v: string): number | undefined {
  const t = v.replace(/\s/g, '').replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export const MESSAGES = {
  prix: 'Indiquez le prix affiché.',
  surface: 'Indiquez la surface.',
  codePostal: 'Code postal à 5 chiffres.',
  ville: 'Indiquez la ville.',
  nombre: 'Nombre attendu.',
  negatif: 'Un montant positif, ou rien.',
  duree: 'Entre 1 et 30 ans.',
} as const;

/** Un champ facultatif : vide, rien à dire ; rempli, un nombre positif. */
function controlerMontant(v: string): string | undefined {
  if (v.trim() === '') return undefined;
  const x = nombre(v);
  if (x === undefined) return MESSAGES.nombre;
  return x < 0 ? MESSAGES.negatif : undefined;
}

/** Seuls prix, surface, code postal et ville sont exigés ; le reste est contrôlé s'il est rempli. */
export function valider(v: Valeurs): Erreurs {
  const erreurs: Erreurs = {};
  const prix = nombre(v.prix);
  if (prix === undefined || prix <= 0) erreurs.prix = MESSAGES.prix;
  const surface = nombre(v.surface);
  if (surface === undefined || surface <= 0) erreurs.surface = MESSAGES.surface;
  if (!/^\d{5}$/.test(v.codePostal.trim())) erreurs.codePostal = MESSAGES.codePostal;
  if (v.ville.trim() === '') erreurs.ville = MESSAGES.ville;
  for (const cle of ['loyerHc', 'apport'] as const) {
    const message = controlerMontant(v[cle]);
    if (message !== undefined) erreurs[cle] = message;
  }
  if (v.dureeAnnees.trim() !== '') {
    const duree = nombre(v.dureeAnnees);
    if (duree === undefined || duree < 1 || duree > 30) erreurs.dureeAnnees = MESSAGES.duree;
  }
  return erreurs;
}

/** Valeurs validées → saisie typée pour `construireProjet` ; un champ facultatif vide reste absent. */
export function versSaisie(
  v: Valeurs,
  provenance: ProvenanceValeurs,
  annonce: AnnonceResolue | null,
): SaisieProjet {
  const opt = (cle: Cle): number | undefined => nombre(v[cle]);
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
    mode: v.mode as ModeLocation,
    loyerHc: opt('loyerHc'),
    apport: opt('apport'),
    dureeAnnees: opt('dureeAnnees'),
    tmi: v.tmi === '' ? undefined : (Number(v.tmi) as SaisieProjet['tmi']),
    provenance,
    annonce: annonce ?? undefined,
  };
}
