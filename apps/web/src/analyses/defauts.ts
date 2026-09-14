import { ProjetSchema, VERSION_REGLES_COURANTE, vacanceSemaines } from '@loupe/moteur';

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
  /** Tranche marginale supposée quand elle n'est pas saisie. */
  readonly tmi: number;
  /** Négociation du prix affiché, en proportion (0 : prix affiché retenu tel quel). */
  readonly negociationTaux: number;
  readonly pno: number;
  readonly comptable: number;
  readonly cfe: number;
  readonly fraisDossier: number;
  readonly fraisGarantie: number;
  readonly mobilierParM2: number;
  readonly coproParM2An: number;
  /** Taxe foncière estimée en mois de loyer quand elle est inconnue. */
  readonly taxeFonciereEnMoisDeLoyer: number;
  /** Taxe foncière estimée par m² et par an quand ni elle ni le loyer ne sont connus. */
  readonly taxeFonciereParM2An: number;
  /** Surface moyenne d'une pièce quand le nombre de pièces est inconnu. */
  readonly surfaceParPiece: number;
  /** Apport et durée du prêt quand ils ne sont pas saisis. */
  readonly apport: number;
  readonly dureeAnnees: number;
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
      location: { mode: 'meuble', loyerHc: LOYER_TEMOIN },
      fiscalite: { regime: 'lmnp_reel' },
    },
  }).hypotheses;
  // Les défauts du formulaire Vérifier : la saisie minimale (quatre champs), complétée par construireProjet.
  const minimal = {
    prix: 120_000,
    surface: SURFACE_TEMOIN,
    codePostal: '69003',
    ville: 'Lyon',
    mode: 'meuble' as const,
    provenance: {},
  };
  const formulaire = ProjetSchema.parse(construireProjet(minimal, 'defauts'));
  const avecLoyer = ProjetSchema.parse(
    construireProjet({ ...minimal, loyerHc: LOYER_TEMOIN }, 'defauts-loyer'),
  );
  const { charges, pret, achat, fiscalite } = formulaire.hypotheses;
  return {
    vacanceSemaines: vacanceSemaines(schema.location),
    entretienTaux: schema.charges.entretienTaux,
    tauxAssurance: schema.pret.tauxAssurance,
    psBic: schema.fiscalite.psBic,
    psFoncier: schema.fiscalite.psFoncier,
    reventeAnnees: schema.revente.annees,
    evolutionAnnuelle: schema.revente.evolutionAnnuelle,
    fraisAgenceTaux: schema.revente.fraisAgenceTaux,
    diagnostics: schema.revente.diagnostics,
    honorairesChargeAcquereur: schema.achat.honorairesChargeAcquereur,
    tmi: fiscalite.tmi,
    negociationTaux: schema.achat.negociationTaux,
    pno: charges.pno,
    comptable: charges.comptable,
    cfe: charges.cfe,
    fraisDossier: pret.fraisDossier,
    fraisGarantie: pret.fraisGarantie,
    mobilierParM2: achat.mobilier / SURFACE_TEMOIN,
    coproParM2An: charges.coproAnnuel / SURFACE_TEMOIN,
    taxeFonciereEnMoisDeLoyer: avecLoyer.hypotheses.charges.taxeFonciere / LOYER_TEMOIN,
    taxeFonciereParM2An: charges.taxeFonciere / SURFACE_TEMOIN,
    surfaceParPiece: SURFACE_TEMOIN / formulaire.bien.pieces,
    apport: pret.apport,
    dureeAnnees: pret.dureeAnnees,
  };
}
