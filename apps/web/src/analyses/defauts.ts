import { ProjetSchema, VERSION_REGLES_COURANTE } from '@loupe/moteur';

import { construireProjet } from '@/annonces';

/**
 * Les valeurs par défaut du moteur et du formulaire, lues dans le code plutôt que recopiées :
 * si un défaut change, la page Méthode suit.
 */
export interface Defauts {
  readonly vacanceSemaines: number;
  readonly entretienTaux: number;
  readonly tauxAssurance: number;
  readonly psBic: number;
  readonly psFoncier: number;
  readonly reventeAnnees: number;
  readonly evolutionAnnuelle: number;
  readonly fraisAgenceTaux: number;
  readonly diagnostics: number;
  readonly honorairesChargeAcquereur: boolean;
  readonly pno: number;
  readonly comptable: number;
  readonly cfe: number;
  readonly fraisDossier: number;
  readonly fraisGarantie: number;
  readonly mobilierParM2: number;
  readonly coproParM2An: number;
  /** Taxe foncière estimée en mois de loyer quand elle est inconnue. */
  readonly taxeFonciereEnMoisDeLoyer: number;
  /** Surface moyenne d'une pièce quand le nombre de pièces est inconnu. */
  readonly surfaceParPiece: number;
}

const SURFACE_TEMOIN = 40;
const LOYER_TEMOIN = 700;

export function defautsDuMoteur(): Defauts {
  // Les défauts des schémas : un projet minimal, complété par Zod.
  const schema = ProjetSchema.parse({
    id: 'defauts',
    versionRegles: VERSION_REGLES_COURANTE,
    bien: { type: 'appartement', surface: SURFACE_TEMOIN, pieces: 2, departement: '69' },
    hypotheses: {
      achat: { prix: 120_000 },
      pret: { tauxNominal: 0.03, dureeAnnees: 20 },
      location: { mode: 'meuble_lld', loyerHc: LOYER_TEMOIN },
      fiscalite: { tmi: 0.3, regime: 'lmnp_reel' },
      revenusMensuels: 2_400,
    },
  }).hypotheses;
  // Les défauts du formulaire Vérifier : une saisie minimale, complétée par construireProjet.
  const formulaire = ProjetSchema.parse(
    construireProjet(
      {
        prix: 120_000,
        surface: SURFACE_TEMOIN,
        codePostal: '69003',
        ville: 'Lyon',
        mode: 'meuble_lld',
        loyerHc: LOYER_TEMOIN,
        apport: 10_000,
        dureeAnnees: 20,
        tmi: 0.3,
        revenusMensuels: 2_400,
        provenance: {},
      },
      'defauts',
    ),
  );
  const { charges, pret, achat } = formulaire.hypotheses;
  return {
    vacanceSemaines: schema.location.vacanceSemaines,
    entretienTaux: schema.charges.entretienTaux,
    tauxAssurance: schema.pret.tauxAssurance,
    psBic: schema.fiscalite.psBic,
    psFoncier: schema.fiscalite.psFoncier,
    reventeAnnees: schema.revente.annees,
    evolutionAnnuelle: schema.revente.evolutionAnnuelle,
    fraisAgenceTaux: schema.revente.fraisAgenceTaux,
    diagnostics: schema.revente.diagnostics,
    honorairesChargeAcquereur: schema.achat.honorairesChargeAcquereur,
    pno: charges.pno,
    comptable: charges.comptable,
    cfe: charges.cfe,
    fraisDossier: pret.fraisDossier,
    fraisGarantie: pret.fraisGarantie,
    mobilierParM2: achat.mobilier / SURFACE_TEMOIN,
    coproParM2An: charges.coproAnnuel / SURFACE_TEMOIN,
    taxeFonciereEnMoisDeLoyer: charges.taxeFonciere / LOYER_TEMOIN,
    surfaceParPiece: SURFACE_TEMOIN / formulaire.bien.pieces,
  };
}
