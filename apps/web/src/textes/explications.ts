import {
  loyerMensuelHc,
  vacanceSemaines,
  type CodeCharge,
  type Resultats,
  type ResultatsComplets,
} from '@loupe/moteur';

import { cascadeAutofinancement, multipleSurApport } from '@/analyses/rapport';
import { euros, nombre, pourcentage, pourcentageSigne } from '@/formatage/nombres';

import { REGIMES, explicationRegime } from './regimes';

/** Explications générales, écrites une fois : résumés des sections de la page Méthode. */
export const EXPLICATIONS = {
  prix: "On compare au prix estimé du bien, calculé sur les ventes signées chez le notaire (base DVF) ramenées à aujourd'hui, pas aux prix affichés dans les annonces, qui sont 5 à 10 % au-dessus du prix final. L'état, l'étage, le DPE, le balcon, les charges et un locataire en place ajustent l'estimation ; l'onglet Estimation montre chaque vente et chaque source.",
  cashflow:
    "Le cash-flow retient toutes les charges : crédit et assurance, taxe foncière, copropriété, assurance propriétaire, comptable, CFE, provision d'entretien, et les semaines sans locataire. C'est ce que les annonces oublient.",
  fiscalite:
    "Chaque régime est projeté année par année sur la durée de détention, avec les déficits et amortissements reportés. Au réel meublé, l'amortissement ne peut pas créer de déficit : l'excédent est mis en réserve sans limite de temps.",
  revente:
    "Valeur estimée à la revente, moins l'agence, le capital restant dû, l'indemnité de remboursement anticipé et l'impôt sur la plus-value. Depuis 2025, les amortissements du meublé au réel sont réintégrés dans la plus-value.",
  leviers:
    'Le prix de négociation est celui qui met le cash-flow à zéro avec vos hypothèses. La colocation majore le loyer total de 35 % et compte un mois de vacance par an.',
  financement:
    "Mensualité constante sur le taux nominal, assurance calculée sur le capital emprunté. Le TAEG ajoute les frais de dossier et la garantie, puis se compare au taux d'usure. Le coût total du crédit additionne intérêts, assurance et frais bancaires sur toute la durée.",
  couverture:
    "Mensualité assurance comprise divisée par le loyer hors charges. La banque compte 70 % des loyers comme revenu, le reste absorbant charges et mois vides : sous 70 %, le loyer porte le crédit dans sa propre lecture. Deklic ne demande pas vos revenus ; l'effort bancaire, c'est elle qui le calculera.",
} as const;

/*
 * Explications du Rapport, avec les chiffres du projet : chaque phrase est composée depuis les
 * résultats du moteur et formatée à l'affichage, jamais recopiée.
 */

const CHARGES =
  'taxe foncière, copropriété, assurance propriétaire, comptable, CFE, gestion, entretien';

/** Les charges propres au type de location, nommées seulement quand le projet en paie. */
const CHARGES_DU_TYPE: readonly (readonly [CodeCharge, string])[] = [
  ['conciergerie', 'conciergerie'],
  ['plateforme', 'commission de plateforme'],
  ['menage', 'ménage'],
  ['energie', 'énergie'],
  ['internet', 'internet'],
];

function charges(r: ResultatsComplets): string {
  const payees = CHARGES_DU_TYPE.filter(([code]) =>
    r.cashflow.charges.some((l) => l.code === code && l.annuel > 0),
  ).map(([, libelle]) => libelle);
  return payees.length === 0 ? CHARGES : `${CHARGES}, ${payees.join(', ')}`;
}

/** « meublé micro-BIC », « nu au réel » : seule l'initiale passe en minuscule, le sigle reste. */
function enMinuscule(libelle: string): string {
  return libelle.charAt(0).toLowerCase() + libelle.slice(1);
}
const regime = (r: ResultatsComplets): string => enMinuscule(REGIMES[r.fiscalite.retenu]);
const annees = (r: Resultats): string => String(r.projet.hypotheses.revente.annees);

/** Le feu prix porte l'écart déjà jugé (décimal) ; `null` sans ventes réelles. */
function ecartPrix(r: Resultats): number | null {
  let ecart: number | null = null;
  for (const f of r.verdict.feux) {
    if (f.axe === 'prix') ecart = f.valeur;
  }
  return ecart;
}

export function explicationPrix(r: Resultats): string {
  const { prix } = r.projet.hypotheses.achat;
  const prixM2 = nombre(prix / r.projet.bien.surface);
  const dvf = r.projet.marche.dvf;
  const ecart = ecartPrix(r);
  if (dvf === undefined || ecart === null) {
    return `Pas de ventes réelles connues autour du bien : le prix affiché (${euros(prix)}, soit ${prixM2} €/m²) n'a pas encore de repère. Renseignez l'adresse dans l'onglet Estimation, ou le marché dans les hypothèses.`;
  }
  const ventes = `${String(dvf.nombreVentes)} ventes signées chez le notaire (base DVF)`;
  const e = r.estimation;
  const repere =
    e === null
      ? `contre une médiane de ${nombre(dvf.medianM2)} €/m² sur ${ventes}`
      : `contre un prix estimé de ${nombre(e.prixM2Estime)} €/m², d'après ${ventes} ramenées à aujourd'hui`;
  return `Le bien est affiché ${prixM2} €/m² ${repere}, soit ${pourcentageSigne(ecart)}. Les prix d'annonces, eux, sont 5 à 10 % au-dessus du prix final ; l'état, l'étage, le DPE, le balcon, les charges et un locataire en place ajustent l'estimation.`;
}

export function explicationAutofinancement(r: ResultatsComplets): string {
  const c = cascadeAutofinancement(r);
  const semaines = vacanceSemaines(r.projet.hypotheses.location);
  const recuperees =
    c.recuperees > 0 ? `, plus ${euros(c.recuperees)} de forfaits et de ménage facturés` : '';
  const enPlus =
    c.vacance > 0 ? ` et ${nombre(semaines)} semaines sans locataire (${euros(c.vacance)})` : '';
  const reste =
    c.apresCharges < 0
      ? `Il manque ${euros(-c.apresCharges)} avant impôt.`
      : `Il reste ${euros(c.apresCharges)} avant impôt.`;
  const impot =
    c.impot > 0
      ? `L'impôt du ${regime(r)} coûte en moyenne ${euros(c.impot)} par mois sur ${annees(r)} ans.`
      : `Au ${regime(r)}, l'impôt est nul sur ${annees(r)} ans.`;
  return `Chaque mois, le loyer de ${euros(c.loyer)}${recuperees} paie d'abord le crédit et l'assurance (${euros(c.credit)}), puis les charges : ${charges(r)} (${euros(c.charges)})${enPlus}. ${reste} ${impot} C'est ce que les annonces oublient.`;
}

export function explicationCouverture(r: ResultatsComplets): string {
  const t = r.cashflow.tauxCouverture;
  if (t === null) return 'Sans loyer, pas de taux de couverture : rien ne porte le crédit.';
  const suite =
    t <= 1
      ? "Sous 100 %, le loyer paie le crédit ; restent ensuite les charges et l'impôt."
      : 'Au-dessus de 100 %, le loyer ne couvre même pas le crédit.';
  return `Taux de couverture : la mensualité, assurance comprise (${euros(r.financement.mensualiteTotale)}), représente ${pourcentage(t, 0)} du loyer (${euros(loyerMensuelHc(r.projet.hypotheses.location))}). ${suite}`;
}

export function explicationEffort(r: ResultatsComplets): string {
  const cf = r.cashflow.mensuel;
  if (cf < 0) {
    return `Ce que vous sortez de votre poche chaque mois pour tenir le projet : ${euros(-cf)}, soit ${euros(-cf * 12)} par an. Quand le cash-flow devient positif, cette case devient un excédent.`;
  }
  return `Ce que le projet vous laisse chaque mois, avant impôt : ${euros(cf)}, soit ${euros(cf * 12)} par an. Un excédent finance d'abord les imprévus avant de finir dans votre poche.`;
}

export function explicationPointMort(r: ResultatsComplets): string {
  const pm = r.cashflow.pointMort;
  if (pm === null) {
    return "En courte durée, pas de loyer d'équilibre : ce sont le prix de la nuit et les nuits louées par mois qui font le cash-flow.";
  }
  const vise = loyerMensuelHc(r.projet.hypotheses.location);
  const position =
    pm > vise
      ? `contre ${euros(vise)} visés aujourd'hui : il manque ${euros(pm - vise)} par mois.`
      : `contre ${euros(vise)} visés aujourd'hui : vous êtes au-dessus, le projet se paie tout seul.`;
  return `Point mort : le loyer hors charges à partir duquel le projet ne coûte plus rien chaque mois, vacance et charges comprises : ${euros(pm)}, ${position}`;
}

function annee1<T extends { readonly annee: number }>(
  lignes: readonly T[],
  valeur: (l: T) => number,
): number {
  let total = 0;
  for (const l of lignes) {
    if (l.annee === 1) total += valeur(l);
  }
  return total;
}

export function explicationRendement(
  r: ResultatsComplets,
  quel: 'brut' | 'net' | 'netNet',
): string {
  const { coutTotal, brut, net, netNet } = r.rendement.rendements;
  const c = r.cashflow;
  const cout = euros(coutTotal);
  const netAnnuel = c.recettes.loyersNets - c.chargesAnnuelles;
  switch (quel) {
    case 'brut':
      return `Loyers annuels hors charges ÷ coût total (prix, travaux et frais d'acquisition) : ${euros(c.recettes.loyersBruts)} ÷ ${cout} = ${pourcentage(brut)}. C'est le chiffre des annonces et des sites : il ignore la vacance et toutes les charges.`;
    case 'net': {
      const retire =
        r.projet.hypotheses.location.mode === 'courte_duree'
          ? 'les nuits non louées (déjà hors des recettes)'
          : `la vacance (${euros(c.recettes.vacance)})`;
      return `Loyers moins ${retire} et toutes les charges (${euros(c.chargesAnnuelles)} : ${charges(r)}), ÷ coût total : ${euros(netAnnuel)} ÷ ${cout} = ${pourcentage(net)}. C'est lui que juge le feu « Rendement ».`;
    }
    case 'netNet': {
      const banque = annee1(r.financement.parAnnee, (a) => a.interets + a.assurance);
      const impot = annee1(r.fiscalite.regimes[r.fiscalite.retenu].annees, (a) => a.impot);
      return `Le net, moins les intérêts et l'assurance de la première année (${euros(banque)}) et l'impôt de la première année (${euros(impot)}, ${regime(r)}) : ${euros(netAnnuel - banque - impot)} ÷ ${cout} = ${pourcentage(netNet)}. Ce qu'il reste vraiment, une fois la banque et le fisc servis.`;
    }
  }
}

export function explicationFiscalite(r: ResultatsComplets): string {
  const f = r.fiscalite;
  const retenu = f.regimes[f.retenu];
  const n = annees(r);
  let moinsCher = retenu;
  // Seuls les régimes possibles pour ce type de location se comparent.
  const autres = Object.values(f.regimes).filter(
    (x) => x.regime !== f.retenu && f.compatibles.includes(x.regime),
  );
  for (const x of autres) {
    if (moinsCher === retenu || x.impotTotal < moinsCher.impotTotal) moinsCher = x;
  }
  const total =
    retenu.impotTotal === 0
      ? `Sur ${n} ans, le ${regime(r)} ne coûte aucun impôt.`
      : `Sur ${n} ans, le ${regime(r)} coûte ${euros(retenu.impotTotal)} d'impôt.`;
  return `${total} ${explicationRegime(retenu, r.projet.hypotheses.revente.annees)} ${autres.length === 1 ? "L'autre régime possible est le" : 'Le moins cher des trois autres régimes est le'} ${enMinuscule(REGIMES[moinsCher.regime])} (${euros(moinsCher.impotTotal)}) ; l'onglet Fiscalité les compare année par année.`;
}

export function explicationRevente(r: ResultatsComplets): string {
  const v = r.revente;
  const evolution = pourcentageSigne(r.projet.hypotheses.revente.evolutionAnnuelle, 1);
  return `Revente estimée à ${euros(v.valeur)} dans ${annees(r)} ans (${evolution} par an), moins l'agence et les diagnostics (${euros(v.fraisVente.total)}), le capital restant dû (${euros(v.crd)}), l'indemnité de remboursement anticipé (${euros(v.ira)}) et l'impôt sur la plus-value (${euros(v.plusValue.impotTotal)}) : ${euros(v.cashNetVendeur)} net vendeur. Depuis 2025, les amortissements du meublé au réel sont réintégrés dans la plus-value.`;
}

export function explicationMultiple(r: ResultatsComplets): string {
  const m = multipleSurApport(r);
  if (m === null) {
    return "Sans mise de départ, le multiple n'a pas de sens : tout le gain vient de l'argent de la banque.";
  }
  const e = r.rendement.enrichissement;
  const signe = m < 0 ? '−' : '';
  const formule = `Gain total ÷ mise de départ : ${euros(e.total)} ÷ ${euros(e.miseDeDepart)} = × ${signe}${nombre(Math.abs(m), 1)}.`;
  if (m < 0) {
    return `${formule} Le projet perd de l'argent sur ${annees(r)} ans : chaque euro mis au départ en perd ${nombre(-m, 1)}.`;
  }
  return `${formule} Pour chaque euro mis au départ, le projet en rend ${nombre(m, 1)} en plus de le restituer, sur ${annees(r)} ans. Au-dessus de × 1, votre argent a doublé.`;
}
