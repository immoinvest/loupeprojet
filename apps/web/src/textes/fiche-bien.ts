import type { ChauffageEnergieCapture, EtatCapture, FicheAnnonce } from '@loupe/capture';

import { dateCourte, euros } from '@/formatage/nombres';

const ENERGIES: Readonly<Record<ChauffageEnergieCapture, string>> = {
  electricite: 'électrique',
  gaz: 'gaz',
  fioul: 'fioul',
  bois: 'bois',
  pompe_a_chaleur: 'pompe à chaleur',
  reseau_de_chaleur: 'réseau de chaleur',
  autre: 'autre énergie',
};

const ETATS: Readonly<Record<EtatCapture, string>> = {
  a_renover: 'À rénover',
  a_rafraichir: 'À rafraîchir',
  bon_etat: 'Bon état',
  renove: 'Rénové ou comme neuf',
};

/** Ce que l'annonce dit avoir : seuls les « oui » deviennent une pastille. */
const EQUIPEMENTS: readonly (readonly [keyof FicheAnnonce, string])[] = [
  ['balcon', 'Balcon'],
  ['terrasse', 'Terrasse'],
  ['jardin', 'Jardin'],
  ['cave', 'Cave'],
  ['parking', 'Parking'],
  ['gardien', 'Gardien'],
  ['digicode', 'Digicode'],
  ['interphone', 'Interphone'],
  ['piscine', 'Piscine'],
  ['climatisation', 'Climatisation'],
  ['cheminee', 'Cheminée'],
  ['accessiblePmr', 'Accessible aux personnes à mobilité réduite'],
];

const pluriel = (n: number, mot: string): string => `${String(n)} ${mot}${n > 1 ? 's' : ''}`;

/** « Chauffage collectif · gaz », « Chauffage individuel », « Chauffage électrique » ; `null` si l'annonce n'en dit rien. */
export function libelleChauffage(fiche: FicheAnnonce): string | null {
  const mode =
    fiche.chauffageCollectif === undefined
      ? null
      : fiche.chauffageCollectif
        ? 'collectif'
        : 'individuel';
  const energie = fiche.chauffageEnergie === undefined ? null : ENERGIES[fiche.chauffageEnergie];
  if (mode === null) return energie === null ? null : `Chauffage ${energie}`;
  return energie === null ? `Chauffage ${mode}` : `Chauffage ${mode} · ${energie}`;
}

function libelleEnergie(fiche: FicheAnnonce): string | null {
  const { budgetEnergieMin: min, budgetEnergieMax: max } = fiche;
  if (min !== undefined && max !== undefined) {
    return `Énergie : ${euros(min)} à ${euros(max)} par an`;
  }
  const seul = min ?? max;
  return seul === undefined ? null : `Énergie : environ ${euros(seul)} par an`;
}

function libelleHonoraires(fiche: FicheAnnonce): string | null {
  if (fiche.honorairesACharge === 'vendeur') return 'Honoraires à la charge du vendeur';
  if (fiche.honorairesACharge !== 'acquereur') return null;
  return fiche.honoraires === undefined
    ? "Honoraires à la charge de l'acquéreur"
    : `Honoraires ${euros(fiche.honoraires)} à la charge de l'acquéreur`;
}

function libelleImmeuble(etages: number | undefined): string | null {
  if (etages === undefined) return null;
  return etages === 0 ? 'Immeuble de plain-pied' : `Immeuble de ${pluriel(etages, 'étage')}`;
}

function libelleSallesEau(nombre: number | undefined): string | null {
  if (nombre === undefined || nombre === 0) return null;
  return nombre === 1 ? "1 salle d'eau" : `${String(nombre)} salles d'eau`;
}

/** Les caractéristiques de l'annonce, une phrase courte chacune, dans un ordre stable. */
export function pastillesFiche(fiche: FicheAnnonce): string[] {
  const libelles: (string | null)[] = [
    fiche.etat === undefined ? null : ETATS[fiche.etat],
    libelleChauffage(fiche),
    libelleImmeuble(fiche.etagesImmeuble),
    libelleSallesEau(fiche.sallesEau),
    ...EQUIPEMENTS.map(([champ, libelle]) => (fiche[champ] === true ? libelle : null)),
    libelleEnergie(fiche),
    fiche.consommationEnergie === undefined
      ? null
      : `${String(fiche.consommationEnergie)} kWh/m²/an`,
    fiche.dateDpe === undefined ? null : `DPE du ${dateCourte(fiche.dateDpe)}`,
    libelleHonoraires(fiche),
    fiche.vendeur === undefined
      ? null
      : fiche.vendeur === 'particulier'
        ? 'Vendu par un particulier'
        : 'Vendu par un professionnel',
    fiche.quartier === undefined ? null : `Quartier ${fiche.quartier}`,
    fiche.publieeLe === undefined ? null : `Annonce publiée le ${dateCourte(fiche.publieeLe)}`,
  ];
  return libelles.filter((libelle): libelle is string => libelle !== null);
}

export const TEXTES_FICHE = {
  titre: 'Le bien',
  photos: "Photos de l'annonce",
  photo: (numero: number, total: number): string =>
    `Photo ${String(numero)} sur ${String(total)} de l'annonce`,
  voir: (portail: string): string => `Voir l'annonce sur ${portail}`,
} as const;
