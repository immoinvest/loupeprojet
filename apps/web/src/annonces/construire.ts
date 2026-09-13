import {
  VERSION_REGLES_COURANTE,
  obtenirRegles,
  type ClasseEnergie,
  type ModeLocation,
  type ProjetEntree,
  type TypeBien,
} from '@loupe/moteur';

import type { MarcheEnrichi } from '@/enrichissement';

import type { AnnonceResolue } from './resoudre';

export type Provenance = 'annonce' | 'estime' | 'utilisateur';

/** Ce que l'écran Vérifier envoie : les valeurs et, pour chacune, d'où elle vient. */
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
  readonly codePostal: string;
  readonly ville: string;
  readonly chargesCoproMois?: number | undefined;
  readonly taxeFonciere?: number | undefined;
  readonly travaux?: number | undefined;
  readonly mode: ModeLocation;
  readonly loyerHc: number;
  readonly apport: number;
  readonly dureeAnnees: number;
  readonly tmi: 0 | 0.11 | 0.3 | 0.41 | 0.45;
  readonly revenusMensuels: number;
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
 * Assemble un projet complet à partir de la saisie vérifiée, avec des défauts sourcés et, quand
 * le Worker a répondu, les données de marché de la commune.
 */
export function construireProjet(
  s: SaisieProjet,
  id: string,
  enrichi: MarcheEnrichi | null = null,
): ProjetEntree {
  const meuble = s.mode !== 'nu';
  const regime = meuble ? 'lmnp_reel' : 'nu_reel';
  const taxeFonciere = s.taxeFonciere ?? s.loyerHc;
  const coproAnnuel =
    s.chargesCoproMois === undefined ? s.surface * COPRO_PAR_M2_AN : s.chargesCoproMois * 12;
  const provenance: Record<string, string> = {
    'achat.prix': s.provenance.prix ?? 'utilisateur',
    'bien.surface': s.provenance.surface ?? 'utilisateur',
    'location.loyerHc': 'utilisateur',
    'pret.apport': 'utilisateur',
    'pret.dureeAnnees': 'utilisateur',
    'pret.tauxNominal': 'usure',
    'fiscalite.tmi': 'utilisateur',
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
  if (s.dpe !== undefined) provenance['bien.dpe'] = s.provenance.dpe ?? 'utilisateur';
  if (s.typeBien !== undefined) provenance['bien.type'] = s.provenance.typeBien ?? 'utilisateur';
  if (s.ges !== undefined) provenance['bien.ges'] = s.provenance.ges ?? 'utilisateur';
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
        travaux: s.travaux ?? 0,
        mobilier: meuble ? Math.round(s.surface * MOBILIER_PAR_M2) : 0,
      },
      pret: {
        apport: s.apport,
        tauxNominal: tauxPourDuree(s.dureeAnnees),
        dureeAnnees: s.dureeAnnees,
        fraisDossier: FRAIS_DOSSIER_DEFAUT,
        fraisGarantie: FRAIS_GARANTIE_DEFAUT,
      },
      location: {
        mode: s.mode,
        loyerHc: s.loyerHc,
        ...(s.mode === 'courte_duree'
          ? { courteDuree: { nuitee: Math.round((s.loyerHc / 30) * 2), tauxOccupation: 0.6 } }
          : {}),
      },
      charges: {
        taxeFonciere,
        coproAnnuel,
        pno: PNO_DEFAUT,
        comptable: meuble ? COMPTABLE_DEFAUT : 0,
        cfe: meuble ? CFE_DEFAUT : 0,
      },
      fiscalite: { tmi: s.tmi, regime },
      revenusMensuels: s.revenusMensuels,
    },
    provenance: { ...provenance, ...(enrichi === null ? {} : enrichi.provenance) },
  };
}
