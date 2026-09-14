/**
 * Migration des projets enregistrés avant les cinq types d'exploitation (septembre 2026) :
 * `meuble_lld` → `meuble`, sous-objet `courteDuree` (taux d'occupation, ménage par nuit) → variante
 * `courte_duree` (nuitées par mois, ménage par séjour). Pure et idempotente ; elle précède `ProjetSchema`
 * et ne valide rien : un projet illisible reste illisible.
 */
type Objet = Readonly<Record<string, unknown>>;

function estObjet(v: unknown): v is Objet {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nombre(v: unknown, defaut: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : defaut;
}

/** Durée de séjour retenue pour convertir un ménage par nuit en ménage par séjour. */
export const DUREE_SEJOUR_MIGRATION_NUITS = 4;
const JOURS_PAR_AN = 365;
const MOIS_PAR_AN = 12;

function migrerCourteDuree(location: Objet, courteDuree: Objet): Objet {
  const occupation = nombre(courteDuree.tauxOccupation, 0);
  const nuiteesParMois = Math.round(((occupation * JOURS_PAR_AN) / MOIS_PAR_AN) * 10) / 10;
  return {
    mode: 'courte_duree',
    nuitee: courteDuree.nuitee,
    nuiteesParMois,
    dureeSejourNuits: DUREE_SEJOUR_MIGRATION_NUITS,
    menageFactureParSejour: 0,
    menageCoutParSejour: nombre(courteDuree.fraisMenageParNuit, 0) * DUREE_SEJOUR_MIGRATION_NUITS,
    plateformeTaux: 0,
    // L'ancienne gestion déléguée d'une courte durée n'a pas d'équivalent : elle s'ajoute à la conciergerie.
    conciergerieTaux: nombre(courteDuree.conciergerieTaux, 0) + nombre(location.gestionTaux, 0),
    tourismeClasse: courteDuree.tourismeClasse === true,
  };
}

function migrerLocation(location: Objet): Objet {
  const { courteDuree, ...reste } = location;
  if (location.mode === 'meuble_lld') return { ...reste, mode: 'meuble' };
  if (location.mode === 'nu') return courteDuree === undefined ? location : reste;
  if (location.mode === 'courte_duree' && estObjet(courteDuree)) {
    return migrerCourteDuree(location, courteDuree);
  }
  return location;
}

/** Ancien format → format courant ; tout autre contenu est rendu tel quel. */
export function migrerProjet(brut: unknown): unknown {
  if (!estObjet(brut) || !estObjet(brut.hypotheses) || !estObjet(brut.hypotheses.location)) {
    return brut;
  }
  const location = migrerLocation(brut.hypotheses.location);
  if (location === brut.hypotheses.location) return brut;
  return { ...brut, hypotheses: { ...brut.hypotheses, location } };
}
