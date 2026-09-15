import { ajouterAnnees } from './bail';
import { ajouterJours } from './dates';
import {
  CLASSES_DPE,
  DECENCE_ENERGETIQUE,
  PREFIXES_OUTRE_MER,
  PREVENANCE_FIN_BAIL_JOURS,
  VALIDITE_DPE,
  type ClasseDpe,
  type EcheanceDecence,
  type FormeBail,
} from './regles-bail';

/*
 * Alertes de conformité d'un bien (G4-5) : déduites à l'affichage, jamais stockées. Les phrases vivent
 * côté web ; ici, des codes et des dates.
 */

export type AlerteConformite =
  /** Nouveau bail ou renouvellement interdit depuis cette date (logement indécent). */
  | { readonly code: 'location_interdite'; readonly classe: ClasseDpe; readonly depuis: string }
  /** La même interdiction, à venir. */
  | {
      readonly code: 'location_interdite_bientot';
      readonly classe: ClasseDpe;
      readonly aPartirDu: string;
    }
  | { readonly code: 'dpe_perime'; readonly depuis: string }
  | { readonly code: 'dpe_manquant' }
  | {
      readonly code: 'fin_bail_court';
      readonly locationId: string;
      readonly forme: Exclude<FormeBail, 'classique'>;
      readonly fin: string;
    };

/** Le dernier jour de validité d'un DPE réalisé ce jour-là. */
export function finValiditeDpe(date: string): string {
  const ancien = VALIDITE_DPE.anciens.find((p) => date >= p.du && date <= p.au);
  if (ancien !== undefined) return ancien.valableJusquau;
  return ajouterJours(ajouterAnnees(date, VALIDITE_DPE.annees), -1);
}

export function estOutreMer(codePostal: string | undefined): boolean {
  return PREFIXES_OUTRE_MER.some((prefixe) => codePostal?.startsWith(prefixe) === true);
}

function calendrier(codePostal: string | undefined): readonly EcheanceDecence[] {
  return estOutreMer(codePostal) ? DECENCE_ENERGETIQUE.outreMer : DECENCE_ENERGETIQUE.metropole;
}

/** Le jour à partir duquel cette classe n'est plus décente, ou `null` si aucune échéance ne la vise. */
export function dateInterdiction(classe: ClasseDpe, codePostal: string | undefined): string | null {
  const rang = CLASSES_DPE.indexOf(classe);
  const dates = calendrier(codePostal)
    .filter((e) => CLASSES_DPE.indexOf(e.classe) <= rang)
    .map((e) => e.aPartirDu)
    .sort();
  return dates[0] ?? null;
}

export interface EntreesConformite {
  readonly codePostal: string | undefined;
  readonly dpeClasse: ClasseDpe | null;
  readonly dpeDate: string | null;
  readonly locations: readonly {
    readonly id: string;
    readonly fin?: string | undefined;
    readonly formeBail: FormeBail;
  }[];
  readonly aujourdhui: string;
}

/** Les alertes d'un bien, dans l'ordre : DPE (classe, validité), puis fins de baux courts. */
export function alertesConformite(entrees: EntreesConformite): AlerteConformite[] {
  const { codePostal, dpeClasse, dpeDate, locations, aujourdhui } = entrees;
  const alertes: AlerteConformite[] = [];
  if (dpeClasse === null) {
    alertes.push({ code: 'dpe_manquant' });
  } else {
    const interdiction = dateInterdiction(dpeClasse, codePostal);
    if (interdiction !== null && interdiction <= aujourdhui) {
      alertes.push({ code: 'location_interdite', classe: dpeClasse, depuis: interdiction });
    } else if (interdiction !== null) {
      alertes.push({
        code: 'location_interdite_bientot',
        classe: dpeClasse,
        aPartirDu: interdiction,
      });
    }
  }
  if (dpeDate !== null) {
    const fin = finValiditeDpe(dpeDate);
    if (fin < aujourdhui) alertes.push({ code: 'dpe_perime', depuis: ajouterJours(fin, 1) });
  }
  for (const location of locations) {
    const { fin, formeBail } = location;
    if (formeBail === 'classique' || fin === undefined) continue;
    if (ajouterJours(fin, -PREVENANCE_FIN_BAIL_JOURS) <= aujourdhui && aujourdhui <= fin) {
      alertes.push({ code: 'fin_bail_court', locationId: location.id, forme: formeBail, fin });
    }
  }
  return alertes;
}

/** Les alertes qui méritent une ligne dans « À faire » (les autres restent sur la fiche). */
export function estUrgente(alerte: AlerteConformite): boolean {
  return (
    alerte.code === 'location_interdite' ||
    alerte.code === 'dpe_perime' ||
    alerte.code === 'fin_bail_court'
  );
}
