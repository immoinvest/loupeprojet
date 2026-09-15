import type { PeriodeAbattement, Regles } from '@loupe/moteur';

import type { Defauts } from '@/analyses';
import { euros } from '@/formatage/nombres';

import { EXPLICATIONS } from './explications';
import { pct, type SectionMethode } from './methode-commun';

const PS_BIC = {
  libelle: 'Prélèvements sociaux sur les BIC (meublé)',
  source: 'Loi de financement de la sécurité sociale 2026',
  chemin: 'fiscalite.prelevementsSociaux.bic',
};

const PS_FONCIER = {
  libelle: 'Prélèvements sociaux sur les revenus fonciers',
  source: 'CSG 9,2 % + CRDS 0,5 % + prélèvement de solidarité 7,5 %',
  chemin: 'fiscalite.prelevementsSociaux.foncier',
};

export function sectionMicroBic(regles: Regles): SectionMethode {
  const { microBic: mb, prelevementsSociaux: ps } = regles.fiscalite;
  return {
    code: 'micro_bic',
    titre: 'Meublé micro-BIC',
    resume: 'Un abattement forfaitaire, aucune charge déductible, jamais de déficit.',
    etapes: [
      `Base imposable = recettes × (1 − ${pct(mb.abattement)}) ; ${pct(mb.abattementTourismeNonClasse)} d'abattement seulement en meublé de tourisme non classé.`,
      `Impôt = base × votre tranche marginale + base × ${pct(ps.bic)} de prélèvements sociaux.`,
      `Au-delà de ${euros(mb.plafond)} de recettes (${euros(mb.plafondTourismeNonClasse)} en tourisme non classé), le régime est fermé : Deklic le signale.`,
    ],
    constantes: [
      {
        libelle: 'Abattement micro-BIC',
        valeur: pct(mb.abattement),
        source: 'CGI art. 50-0',
        chemin: 'fiscalite.microBic.abattement',
      },
      {
        libelle: 'Abattement en meublé de tourisme non classé',
        valeur: pct(mb.abattementTourismeNonClasse),
        source: 'CGI art. 50-0, loi du 19 novembre 2024',
      },
      {
        libelle: 'Plafond de recettes',
        valeur: euros(mb.plafond),
        source: 'CGI art. 50-0 ; seuil 2026-2028 retenu par la spec Deklic',
      },
      {
        libelle: 'Plafond en tourisme non classé',
        valeur: euros(mb.plafondTourismeNonClasse),
        source: 'CGI art. 50-0, loi du 19 novembre 2024',
      },
      { ...PS_BIC, valeur: pct(ps.bic) },
    ],
  };
}

export function sectionLmnpReel(regles: Regles): SectionMethode {
  const { amortissement: am, prelevementsSociaux: ps, deficitBic } = regles.fiscalite;
  const composants = am.composants
    .map((c) => `${pct(c.part)} sur ${String(c.dureeAnnees)} ans`)
    .join(' et ');
  return {
    code: 'lmnp_reel',
    titre: 'Meublé au réel (LMNP)',
    resume:
      "Toutes les charges et les amortissements se déduisent ; l'impôt arrive souvent des années plus tard.",
    etapes: [
      "Résultat avant amortissement = recettes − charges d'exploitation − assurance emprunteur − intérêts payés − frais d'acquisition et bancaires (année 1).",
      `Amortissement du bâti : prix hors honoraires × (1 − ${pct(am.partTerrain)} de terrain), en ${composants} ; travaux sur ${String(am.travauxDureeAnnees)} ans ; mobilier sur ${String(am.mobilierDureeAnnees)} ans.`,
      "Art. 39 C : l'amortissement ne crée pas de déficit ; la part non déduite se reporte sans limite de durée.",
      `Un déficit hors amortissement se reporte ${String(deficitBic.reportAnnees)} ans sur les mêmes revenus ; il ne s'impute que sur le bénéfice qui reste après tous les amortissements, de l'année et reportés (Conseil d'État, 15 avril 2015).`,
      `Impôt = base × votre tranche + base × ${pct(ps.bic)} de prélèvements sociaux. Les amortissements du bâti déduits sont réintégrés à la plus-value depuis le 15 février 2025.`,
    ],
    constantes: [
      {
        libelle: 'Part du terrain, non amortissable',
        valeur: pct(am.partTerrain),
        source: 'Doctrine administrative : le terrain ne s’amortit pas ; part retenue par usage',
        chemin: 'fiscalite.amortissement.partTerrain',
      },
      {
        libelle: 'Composants du bâti',
        valeur: composants,
        source: 'Décomposition simplifiée, décision ADR-M4 du moteur',
      },
      {
        libelle: 'Durée d’amortissement des travaux et du mobilier',
        valeur: `${String(am.travauxDureeAnnees)} ans · ${String(am.mobilierDureeAnnees)} ans`,
        source: 'Usages comptables',
      },
      {
        libelle: 'Report des déficits BIC non professionnels',
        valeur: `${String(deficitBic.reportAnnees)} ans`,
        source: 'CGI art. 156 I 1° ter',
      },
      {
        libelle: 'Limitation des amortissements',
        valeur: 'aucun déficit par amortissement, report illimité',
        source: 'CGI art. 39 C II',
      },
      { ...PS_BIC, valeur: pct(ps.bic) },
    ],
  };
}

export function sectionMicroFoncier(regles: Regles): SectionMethode {
  const { microFoncier: mf, prelevementsSociaux: ps } = regles.fiscalite;
  return {
    code: 'micro_foncier',
    titre: 'Nu micro-foncier',
    resume: 'Le plus simple : un abattement, pas de charges, pas de déficit.',
    etapes: [
      `Base imposable = loyers × (1 − ${pct(mf.abattement)}).`,
      `Impôt = base × votre tranche + base × ${pct(ps.foncier)} de prélèvements sociaux.`,
      `Fermé au-delà de ${euros(mf.plafond)} de loyers par an.`,
    ],
    constantes: [
      { libelle: 'Abattement micro-foncier', valeur: pct(mf.abattement), source: 'CGI art. 32' },
      { libelle: 'Plafond de loyers', valeur: euros(mf.plafond), source: 'CGI art. 32' },
      { ...PS_FONCIER, valeur: pct(ps.foncier) },
    ],
  };
}

export function sectionNuReel(regles: Regles): SectionMethode {
  const { deficitFoncier: df, prelevementsSociaux: ps } = regles.fiscalite;
  return {
    code: 'nu_reel',
    titre: 'Nu au réel',
    resume: 'Charges et intérêts déductibles ; le déficit foncier réduit votre revenu global.',
    etapes: [
      "Résultat = loyers − charges d'exploitation − assurance emprunteur − intérêts payés − travaux (année 1).",
      `Déficit hors intérêts imputé sur le revenu global jusqu'à ${euros(df.plafondRevenuGlobal)} par an (${euros(df.plafondRenovationEnergetique)} quand la case « Ces travaux font sortir le logement des classes E, F ou G » est cochée : elle n'apparaît qu'en location nue avec des travaux) ; le reste, intérêts compris, se reporte ${String(df.reportAnnees)} ans sur les revenus fonciers.`,
      `Impôt = base × votre tranche + base × ${pct(ps.foncier)} ; l'imputation sur le revenu global vous rend votre tranche × le déficit imputé.`,
    ],
    constantes: [
      {
        libelle: "Plafond d'imputation du déficit foncier",
        valeur: euros(df.plafondRevenuGlobal),
        source: 'CGI art. 156 I 3°',
      },
      {
        libelle: 'Plafond doublé pour rénovation énergétique',
        valeur: euros(df.plafondRenovationEnergetique),
        source:
          'CGI art. 156 I 3°, loi de finances rectificative 2022 ; prolongation au 31/12/2027 retenue par la spec Deklic',
      },
      {
        libelle: 'Report du déficit foncier',
        valeur: `${String(df.reportAnnees)} ans`,
        source: 'CGI art. 156 I 3°',
      },
      { ...PS_FONCIER, valeur: pct(ps.foncier) },
    ],
  };
}

function periodes(abattements: readonly PeriodeAbattement[]): string {
  return abattements
    .map((p) =>
      p.deAnnee === p.aAnnee
        ? `${pct(p.tauxParAn)} la ${String(p.deAnnee)}e année`
        : `${pct(p.tauxParAn)} par an de la ${String(p.deAnnee)}e à la ${String(p.aAnnee)}e année`,
    )
    .join(', ');
}

export function sectionRevente(regles: Regles, defauts: Defauts): SectionMethode {
  const { plusValue: pv, prelevementsSociaux: ps } = regles.fiscalite;
  const abattementsIr = periodes(pv.abattementIr);
  const abattementsPs = periodes(pv.abattementPs);
  const surtaxe = pv.surtaxe
    .filter((t) => t.taux > 0)
    .map((t) =>
      t.jusqua === null ? `${pct(t.taux)} au-delà` : `${pct(t.taux)} jusqu'à ${euros(t.jusqua)}`,
    )
    .join(', ');
  return {
    code: 'revente',
    titre: 'La revente et la plus-value',
    resume: EXPLICATIONS.revente,
    etapes: [
      `Valeur de revente = prix × (1 + évolution annuelle)^années ; par défaut ${pct(defauts.evolutionAnnuelle)} par an sur ${String(defauts.reventeAnnees)} ans. Frais de vente = agence ${pct(defauts.fraisAgenceTaux)} + diagnostics ${euros(defauts.diagnostics)}.`,
      'Cash net vendeur = valeur − frais de vente − capital restant dû − indemnité de remboursement anticipé − impôt sur la plus-value.',
      `Prix d'acquisition majoré = prix + max(frais réels, ${pct(pv.forfaitFrais)}) + max(travaux réels, ${pct(pv.forfaitTravaux)} à partir de ${String(pv.forfaitTravauxDesAnnee)} ans de détention) − amortissements du bâti déduits en LMNP réel.`,
      `Abattements pour durée de détention : impôt sur le revenu ${abattementsIr} ; prélèvements sociaux ${abattementsPs}.`,
      `Impôt = base IR × ${pct(pv.tauxIr)} + base PS × ${pct(ps.plusValue)} + surtaxe (${surtaxe}) quand la base dépasse ${euros(pv.surtaxeSeuil)}.`,
      "Impôt total d'un régime (onglet Fiscalité) = impôt pendant la location + impôt sur la plus-value calculé pour ce régime : seul le meublé au réel réintègre ses amortissements, ce qui peut effacer l'avantage gagné pendant la location.",
    ],
    constantes: [
      {
        libelle: 'Impôt sur le revenu sur la plus-value',
        valeur: pct(pv.tauxIr),
        source: 'CGI art. 200 B',
      },
      {
        libelle: 'Prélèvements sociaux sur la plus-value',
        valeur: pct(ps.plusValue),
        source: 'Code de la sécurité sociale, art. L136-7',
        chemin: 'fiscalite.prelevementsSociaux.plusValue',
      },
      {
        libelle: "Forfait de frais d'acquisition",
        valeur: pct(pv.forfaitFrais),
        source: 'CGI art. 150 VB II 3°',
      },
      {
        libelle: 'Forfait de travaux',
        valeur: `${pct(pv.forfaitTravaux)} dès ${String(pv.forfaitTravauxDesAnnee)} ans de détention`,
        source: 'CGI art. 150 VB II 4°',
      },
      {
        libelle: 'Abattements impôt sur le revenu',
        valeur: abattementsIr,
        source: 'CGI art. 150 VC',
      },
      {
        libelle: 'Abattements prélèvements sociaux',
        valeur: abattementsPs,
        source: 'Code de la sécurité sociale, art. L136-7 VI',
      },
      {
        libelle: 'Surtaxe sur les plus-values élevées',
        valeur: `${surtaxe}, au-delà de ${euros(pv.surtaxeSeuil)}`,
        source: 'CGI art. 1609 nonies G',
      },
      {
        libelle: 'Réintégration des amortissements (LMNP réel)',
        valeur: 'cessions depuis le 15/02/2025, mobilier exclu',
        source: 'Loi de finances 2025, art. 84 ; CGI art. 150 VB II 8°',
      },
    ],
  };
}
