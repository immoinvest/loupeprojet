import {
  TMI_PAR_DEFAUT,
  VERSION_REGLES_COURANTE,
  estModeMeuble,
  estimerTravaux,
  obtenirRegles,
  type ClasseEnergie,
  type EtatBien,
  type ModeLocation,
  type ProjetEntree,
  type TypeBien,
} from '@loupe/moteur';

import type { MarcheEnrichi } from '@/enrichissement/marche';

import { apportParDefaut, coutTotalDuProjet } from './apport';
import { construireLocation, loyerRetenu } from './location-saisie';
import type { AnnonceResolue } from './resoudre';

export type Provenance = 'annonce' | 'estime' | 'utilisateur';

/**
 * Ce que l'écran Vérifier envoie : les valeurs et, pour chacune, d'où elle vient.
 * Quatre valeurs suffisent : prix, surface, code postal, ville. Le reste est estimé ou reste absent.
 */
export interface SaisieProjet {
  readonly typeBien?: TypeBien | undefined;
  readonly ges?: ClasseEnergie | undefined;
  readonly lotsCopro?: number | undefined;
  readonly coproEnProcedure?: boolean | undefined;
  readonly prix: number;
  readonly honorairesAgence?: number | undefined;
  readonly surface: number;
  readonly pieces?: number | undefined;
  readonly chambres?: number | undefined;
  readonly etage?: number | undefined;
  readonly ascenseur?: boolean | undefined;
  readonly annee?: number | undefined;
  readonly dpe?: ClasseEnergie | undefined;
  readonly etat?: EtatBien | undefined;
  readonly exterieur?: boolean | undefined;
  readonly venduLoue?: boolean | undefined;
  readonly codePostal: string;
  readonly ville: string;
  readonly chargesCoproMois?: number | undefined;
  readonly taxeFonciere?: number | undefined;
  readonly travaux?: number | undefined;
  /** Type d'exploitation. */
  readonly mode: ModeLocation;
  /**
   * Loyer mensuel hors charges visé pour le logement entier : loyer d'une nue, meublée ou moyenne
   * durée ; loyer total d'une colocation ; loyer meublé de référence d'une courte durée. Absent : le
   * loyer de marché de la commune s'il est connu, sinon le rapport attend le loyer.
   */
  readonly loyerHc?: number | undefined;
  /** Colocation : chambres louées (sinon celles du bien) et loyer par chambre (sinon loyer ÷ chambres). */
  readonly chambresLouees?: number | undefined;
  readonly loyerChambre?: number | undefined;
  /** Courte durée : nuitée et nuits par mois (sinon déduites du loyer et des règles). */
  readonly nuitee?: number | undefined;
  readonly nuiteesParMois?: number | undefined;
  readonly apport?: number | undefined;
  readonly dureeAnnees?: number | undefined;
  readonly tmi?: 0 | 0.11 | 0.3 | 0.41 | 0.45 | undefined;
  readonly provenance: Readonly<Partial<Record<keyof SaisieProjet, Provenance>>>;
  readonly annonce?: AnnonceResolue | undefined;
}

const COPRO_PAR_M2_AN = 25;
const PNO_DEFAUT = 150;
const COMPTABLE_DEFAUT = 420;
const CFE_DEFAUT = 180;
const FRAIS_DOSSIER_DEFAUT = 850;
const FRAIS_GARANTIE_DEFAUT = 1_500;
const MOBILIER_PAR_M2 = 75;
/** Sans durée indiquée : la durée maximale HCSF, celle du meilleur cash-flow. */
export const DUREE_DEFAUT_ANNEES = 25;
/** Taxe foncière estimée quand ni elle ni le loyer ne sont connus : ordre de grandeur, par m² et par an. */
export const TAXE_FONCIERE_PAR_M2_AN = 14;

/** « 13005 » → « 13 », « 20000 » → « 2A », « 20200 » → « 2B », « 97400 » → « 974 ». */
export function departementDuCodePostal(codePostal: string): string {
  if (codePostal.startsWith('97') || codePostal.startsWith('98')) return codePostal.slice(0, 3);
  if (codePostal.startsWith('20')) return Number(codePostal) < 20_200 ? '2A' : '2B';
  return codePostal.slice(0, 2);
}

/** Taux moyen du mois pour la durée demandée (15, 20 ou 25 ans). */
export function tauxPourDuree(dureeAnnees: number): number {
  const { tauxMoyens } = obtenirRegles(VERSION_REGLES_COURANTE).credit;
  if (dureeAnnees <= 15) return tauxMoyens['15'];
  return dureeAnnees <= 20 ? tauxMoyens['20'] : tauxMoyens['25'];
}

export function nomDuProjet(s: SaisieProjet): string {
  const type =
    s.pieces === undefined
      ? `${String(s.surface)} m²`
      : `T${String(s.pieces)} · ${String(s.surface)} m²`;
  return `${type} · ${s.ville}`;
}

/**
 * Assemble un projet à partir de la saisie vérifiée, avec des défauts sourcés et, quand le Worker a
 * répondu, les données de marché de la commune. Sans loyer connu, le projet n'en porte pas : le
 * rapport le demandera. Sans apport indiqué : 10 % du coût total, qui ne dépend pas de l'apport.
 */
export function construireProjet(
  s: SaisieProjet,
  id: string,
  enrichi: MarcheEnrichi | null = null,
): ProjetEntree {
  const projet = assembler(s, id, enrichi, s.apport ?? 0);
  if (s.apport !== undefined) return projet;
  const apport = apportParDefaut(coutTotalDuProjet(projet) ?? 0);
  const { hypotheses } = projet;
  return { ...projet, hypotheses: { ...hypotheses, pret: { ...hypotheses.pret, apport } } };
}

function assembler(
  s: SaisieProjet,
  id: string,
  enrichi: MarcheEnrichi | null,
  apport: number,
): ProjetEntree {
  const meuble = estModeMeuble(s.mode);
  const regime = meuble ? 'lmnp_reel' : 'nu_reel';
  const loyer = loyerRetenu(s, enrichi);
  const dureeAnnees = s.dureeAnnees ?? DUREE_DEFAUT_ANNEES;
  const tmi = s.tmi ?? TMI_PAR_DEFAUT;
  const taxeFonciere =
    s.taxeFonciere ??
    (loyer === null ? Math.round(s.surface * TAXE_FONCIERE_PAR_M2_AN) : loyer.valeur);
  const coproAnnuel =
    s.chargesCoproMois === undefined ? s.surface * COPRO_PAR_M2_AN : s.chargesCoproMois * 12;
  /** Une valeur absente de la saisie est estimée ; présente, elle porte sa provenance ou vient de la personne. */
  const provenanceDe = (cle: keyof SaisieProjet, valeur: unknown): Provenance =>
    valeur === undefined ? 'estime' : (s.provenance[cle] ?? 'utilisateur');
  const location = construireLocation(s, loyer);
  // Sans montant indiqué, les travaux suivent l'état du bien (0 € tant qu'il est inconnu).
  const travauxEstimes = estimerTravaux(s, obtenirRegles(VERSION_REGLES_COURANTE));
  const travaux = s.travaux ?? travauxEstimes?.estime ?? 0;
  const provenance: Record<string, string> = {
    'achat.travaux': provenanceDe('travaux', s.travaux),
    'achat.prix': s.provenance.prix ?? 'utilisateur',
    'bien.surface': s.provenance.surface ?? 'utilisateur',
    'location.mode': s.provenance.mode ?? 'utilisateur',
    ...location.provenance,
    'pret.apport': provenanceDe('apport', s.apport),
    'pret.dureeAnnees': provenanceDe('dureeAnnees', s.dureeAnnees),
    'pret.tauxNominal': 'usure',
    'fiscalite.tmi': provenanceDe('tmi', s.tmi),
    'charges.taxeFonciere':
      s.taxeFonciere === undefined ? 'estime' : (s.provenance.taxeFonciere ?? 'utilisateur'),
    'charges.coproAnnuel':
      s.chargesCoproMois === undefined
        ? 'estime'
        : (s.provenance.chargesCoproMois ?? 'utilisateur'),
    'charges.pno': 'estime',
    'charges.comptable': 'estime',
    'charges.cfe': 'estime',
    'achat.mobilier': 'estime',
  };
  if (location.charges.energieMensuel > 0) provenance['charges.energieMensuel'] = 'estime';
  if (location.charges.internetMensuel > 0) provenance['charges.internetMensuel'] = 'estime';
  if (s.dpe !== undefined) provenance['bien.dpe'] = s.provenance.dpe ?? 'utilisateur';
  if (s.typeBien !== undefined) provenance['bien.type'] = s.provenance.typeBien ?? 'utilisateur';
  if (s.ges !== undefined) provenance['bien.ges'] = s.provenance.ges ?? 'utilisateur';
  if (s.etat !== undefined) provenance['bien.etat'] = s.provenance.etat ?? 'utilisateur';
  if (s.exterieur !== undefined) {
    provenance['bien.exterieur'] = s.provenance.exterieur ?? 'utilisateur';
  }
  if (s.venduLoue !== undefined) {
    provenance['bien.venduLoue'] = s.provenance.venduLoue ?? 'utilisateur';
  }
  if (s.lotsCopro !== undefined) {
    provenance['bien.copro.lots'] = s.provenance.lotsCopro ?? 'utilisateur';
  }
  if (s.coproEnProcedure !== undefined) {
    provenance['bien.copro.procedure'] = s.provenance.coproEnProcedure ?? 'utilisateur';
  }
  const copro =
    s.lotsCopro === undefined && s.coproEnProcedure === undefined
      ? {}
      : {
          copro: {
            ...(s.lotsCopro === undefined ? {} : { lots: s.lotsCopro }),
            ...(s.coproEnProcedure === undefined ? {} : { procedure: s.coproEnProcedure }),
          },
        };

  return {
    id,
    versionRegles: VERSION_REGLES_COURANTE,
    bien: {
      type: s.typeBien ?? 'appartement',
      ...(s.ges === undefined ? {} : { ges: s.ges }),
      ...copro,
      surface: s.surface,
      pieces: s.pieces ?? Math.max(1, Math.round(s.surface / 22)),
      ...(s.chambres === undefined ? {} : { chambres: s.chambres }),
      ...(s.etage === undefined ? {} : { etage: s.etage }),
      ...(s.ascenseur === undefined ? {} : { ascenseur: s.ascenseur }),
      ...(s.annee === undefined ? {} : { annee: s.annee }),
      ...(s.dpe === undefined ? {} : { dpe: s.dpe }),
      ...(s.etat === undefined ? {} : { etat: s.etat }),
      ...(s.exterieur === undefined ? {} : { exterieur: s.exterieur }),
      ...(s.venduLoue === undefined ? {} : { venduLoue: s.venduLoue }),
      departement: departementDuCodePostal(s.codePostal),
    },
    ...(enrichi === null ? {} : { marche: enrichi.marche }),
    ...(s.annonce === undefined
      ? {}
      : { source: { portail: s.annonce.portail, id: s.annonce.id, url: s.annonce.urlCanonique } }),
    hypotheses: {
      achat: {
        prix: s.prix,
        honorairesAgence: s.honorairesAgence ?? 0,
        travaux,
        travauxChoix: s.travaux === undefined ? 'estime' : 'saisi',
        mobilier: meuble ? Math.round(s.surface * MOBILIER_PAR_M2) : 0,
      },
      pret: {
        apport,
        tauxNominal: tauxPourDuree(dureeAnnees),
        dureeAnnees,
        fraisDossier: FRAIS_DOSSIER_DEFAUT,
        fraisGarantie: FRAIS_GARANTIE_DEFAUT,
      },
      location: location.location,
      charges: {
        taxeFonciere,
        coproAnnuel,
        pno: PNO_DEFAUT,
        comptable: meuble ? COMPTABLE_DEFAUT : 0,
        cfe: meuble ? CFE_DEFAUT : 0,
        energieMensuel: location.charges.energieMensuel,
        internetMensuel: location.charges.internetMensuel,
      },
      fiscalite: { tmi, regime },
    },
    provenance: { ...provenance, ...(enrichi === null ? {} : enrichi.provenance) },
  };
}
