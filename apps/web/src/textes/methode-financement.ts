import type { Regles } from '@loupe/moteur';

import type { Defauts } from '@/analyses';
import { euros } from '@/formatage/nombres';

import { EXPLICATIONS } from './explications';
import { pct, type SectionMethode } from './methode-commun';

export function sectionAcquisition(regles: Regles): SectionMethode {
  const a = regles.acquisition;
  const tranches = a.emoluments
    .map((t) =>
      t.jusqua === null ? `${pct(t.taux)} au-delà` : `${pct(t.taux)} jusqu'à ${euros(t.jusqua)}`,
    )
    .join(', ');
  const reduits = Object.entries(a.dmtoParDepartement)
    .map(([departement, taux]) => `${departement} : ${pct(taux)}`)
    .join(', ');
  return {
    code: 'acquisition',
    titre: "Les frais d'acquisition",
    resume:
      "Calculés par la formule réelle sur le prix hors honoraires d'agence, pas au forfait de 8 %.",
    etapes: [
      "Base = prix affiché − honoraires d'agence quand ils sont à votre charge.",
      `Droits = base × (${pct(a.dmtoDefaut)} de droits départementaux × (1 + ${pct(a.fraisAssiette)} de frais d'assiette) + ${pct(a.taxeCommunale)} de taxe communale).`,
      `Émoluments du notaire par tranches cumulées : ${tranches} ; plus la TVA à ${pct(a.tva)}.`,
      `Contribution de sécurité immobilière ${pct(a.contributionSecuriteImmobiliere)} et débours ${pct(a.debours)} de la base.`,
      'Total = droits + émoluments TTC + contribution + débours.',
    ],
    constantes: [
      {
        libelle: 'Droits départementaux (DMTO)',
        valeur: pct(a.dmtoDefaut),
        source:
          'CGI art. 1594 D ; taux relevé par les départements jusqu’au 31/03/2028 (loi de finances 2025)',
        chemin: 'acquisition.dmtoDefaut',
      },
      {
        libelle: 'Départements restés au taux de base',
        valeur: reduits,
        source: 'Liste tenue à la main',
        chemin: 'acquisition.dmtoParDepartement',
      },
      {
        libelle: 'Taxe communale additionnelle',
        valeur: pct(a.taxeCommunale),
        source: 'CGI art. 1584',
        chemin: 'acquisition.taxeCommunale',
      },
      {
        libelle: 'Frais d’assiette et de recouvrement',
        valeur: `${pct(a.fraisAssiette)} des droits départementaux`,
        source: 'CGI art. 1647 V',
      },
      {
        libelle: 'Émoluments du notaire',
        valeur: tranches,
        source: 'Tarif réglementé des notaires, arrêté du 28 février 2020',
      },
      { libelle: 'TVA sur les émoluments', valeur: pct(a.tva), source: 'CGI art. 278' },
      {
        libelle: 'Contribution de sécurité immobilière',
        valeur: pct(a.contributionSecuriteImmobiliere),
        source: 'CGI art. 879',
      },
      {
        libelle: 'Débours',
        valeur: pct(a.debours),
        source: 'Ordre de grandeur constaté, spec Deklic',
      },
    ],
  };
}

export function sectionCredit(regles: Regles): SectionMethode {
  const { tauxMoyens, tauxUsure, hcsf, ira } = regles.credit;
  const dureeMax = `${String(hcsf.dureeMaxAnnees)} ans (${String(hcsf.dureeMaxTravauxAnnees)} ans si les travaux dépassent ${pct(hcsf.seuilTravauxPourDureeMax)} du prix)`;
  const indemnite = `min(${String(ira.moisInterets)} mois d'intérêts, ${pct(ira.plafondCapital)} du capital restant dû)`;
  return {
    code: 'credit',
    titre: 'Le crédit',
    resume: 'Mensualité constante, coût complet du crédit, effort tel que la banque le calcule.',
    etapes: [
      "Emprunt = prix + travaux + frais d'acquisition + frais de dossier + garantie − apport. Le mobilier n'est pas financé : mise de départ = apport + mobilier.",
      "Mensualité constante (formule PMT) sur le taux nominal ; assurance = capital emprunté × taux d'assurance ÷ 12, chaque mois.",
      'Différé total : intérêts capitalisés, aucune mensualité ; différé partiel : intérêts seuls. La mensualité de croisière est recalculée après le différé.',
      "TAEG : le taux qui égalise le capital net des frais et toutes les mensualités, résolu numériquement, avec et sans assurance ; comparé au taux d'usure.",
      `Taux d'effort HCSF = mensualité assurance comprise ÷ (revenus nets + ${pct(hcsf.partLoyers)} des loyers). Seuil ${pct(hcsf.seuilEffort)} ; durée ${dureeMax}.`,
      `Indemnité de remboursement anticipé = ${indemnite}.`,
    ],
    constantes: [
      {
        libelle: 'Taux moyens proposés (15, 20, 25 ans)',
        valeur: `${pct(tauxMoyens['15'])} · ${pct(tauxMoyens['20'])} · ${pct(tauxMoyens['25'])}`,
        source: 'Observatoire Crédit Logement / CSA, août 2026',
        chemin: 'credit.tauxMoyens',
      },
      {
        libelle: "Taux d'usure (prêts de 20 ans et plus)",
        valeur: pct(tauxUsure),
        source: 'Banque de France, 3e trimestre 2026',
        chemin: 'credit.tauxUsure',
      },
      {
        libelle: "Seuil d'effort et part des loyers retenue",
        valeur: `${pct(hcsf.seuilEffort)} · ${pct(hcsf.partLoyers)} des loyers`,
        source: 'Haut Conseil de stabilité financière, décision du 29 septembre 2021',
      },
      {
        libelle: 'Durée maximale du prêt',
        valeur: dureeMax,
        source: 'Haut Conseil de stabilité financière, même décision',
      },
      {
        libelle: 'Indemnité de remboursement anticipé',
        valeur: indemnite,
        source: 'Code de la consommation, art. R313-25',
      },
    ],
  };
}

export function sectionCashflow(regles: Regles, defauts: Defauts): SectionMethode {
  const e = regles.exploitation;
  return {
    code: 'cashflow',
    titre: 'Le cash-flow',
    resume: EXPLICATIONS.cashflow,
    etapes: [
      `Loyers nets = loyer hors charges × 12 − vacance (semaines vides ÷ 52 ; ${String(defauts.vacanceSemaines)} semaines par défaut).`,
      "Courte durée : nuitée × 365 × taux d'occupation − ménage − conciergerie ; la vacance est déjà dans l'occupation.",
      `Charges pleines : taxe foncière, copropriété, assurance propriétaire, comptable (réel meublé), CFE (meublé), gestion (% des loyers), entretien (${pct(defauts.entretienTaux)} du prix par an).`,
      "Cash-flow mensuel = (loyers nets − charges − 12 mensualités assurance comprise) ÷ 12 ; effort d'épargne = ce qu'il manque quand il est négatif.",
      'Point mort = loyer qui met le cash-flow à zéro ; taux de couverture = mensualité assurance comprise ÷ loyer.',
      `Régimes nus : loyer nu saisi, sinon loyer meublé ÷ (1 + ${pct(e.primeMeuble)}). Régimes meublés d'un bien loué nu : loyer × (1 + ${pct(e.primeMeuble)}).`,
    ],
    constantes: [
      {
        libelle: 'Écart de loyer meublé / nu',
        valeur: pct(e.primeMeuble),
        source: 'Observation de marché, spec Deklic (+15 à +25 % selon les villes)',
        chemin: 'exploitation.primeMeuble',
      },
      {
        libelle: 'Colocation : supplément de loyer total et vacance',
        valeur: `+${pct(e.primeColocation)} · ${String(e.vacanceSemainesColocation)} semaines par an`,
        source: 'Spec Deklic (+30 à +45 % observés, un mois de vacance)',
      },
      {
        libelle: 'Vacance par défaut',
        valeur: `${String(defauts.vacanceSemaines)} semaines par an`,
        source: 'Spec Deklic (trois semaines en location longue durée)',
      },
      {
        libelle: "Provision d'entretien par défaut",
        valeur: `${pct(defauts.entretienTaux)} du prix par an`,
        source: 'Spec Deklic',
      },
    ],
  };
}

export function sectionRendements(): SectionMethode {
  return {
    code: 'rendement',
    titre: 'Les rendements',
    resume:
      "Trois lectures du même bien, toutes sur le coût complet : prix + travaux + frais d'acquisition.",
    etapes: [
      'Brut = loyers annuels hors charges ÷ coût complet.',
      'Net = (loyers nets de vacance − charges pleines) ÷ coût complet.',
      'Net-net = (loyers nets − charges − intérêts − assurance − impôt de la première année) ÷ coût complet.',
    ],
    constantes: [],
  };
}

export function sectionSimulateur(regles: Regles, defauts: Defauts): SectionMethode {
  const { tauxMoyens, tauxUsure, hcsf } = regles.credit;
  return {
    code: 'simulateur',
    titre: 'Le simulateur de prêt',
    resume:
      "Deux offres côte à côte, avec les formules du crédit d'un projet ; tout reste dans votre navigateur.",
    etapes: [
      "Montant emprunté = prix + travaux + frais de notaire − apport. Les frais de dossier et de garantie s'ajoutent seulement s'ils sont « financés par le prêt » ; par défaut ils sont payés à la signature, comme dans une offre réelle.",
      "Frais de notaire estimés par la formule des frais d'acquisition, sur le prix hors honoraires d'agence, au taux du département s'il est donné ; modifiables à la main.",
      "Mensualité constante (formule PMT) sur le taux nominal ; assurance = capital emprunté × taux d'assurance ÷ 12, chaque mois, sur le capital initial (simplification : une assurance sur le capital restant dû coûterait moins).",
      'Différé total : intérêts capitalisés, aucune mensualité ; différé partiel : intérêts seuls ; la mensualité de croisière est recalculée ensuite.',
      "TAEG : le taux qui égalise le capital net des frais bancaires et toutes les mensualités, résolu numériquement, hors et avec assurance ; comparé au taux d'usure.",
      'Coût total du crédit = intérêts + assurance + frais de dossier + garantie.',
      `Taux d'endettement = mensualité assurance comprise ÷ revenus nets. Distinct de l'effort HCSF d'un projet, qui compte ${pct(hcsf.partLoyers)} des loyers attendus.`,
      'Comparaison : pour chaque critère, la plus petite valeur est la meilleure (à 1 centime ou 0,001 point près) ; durée et montant emprunté restent informatifs.',
    ],
    constantes: [
      {
        libelle: 'Taux nominal proposé par défaut (20 ans)',
        valeur: pct(tauxMoyens['20']),
        source: 'Observatoire Crédit Logement / CSA, août 2026',
        chemin: 'credit.tauxMoyens',
      },
      {
        libelle: "Taux d'usure (prêts de 20 ans et plus)",
        valeur: pct(tauxUsure),
        source: 'Banque de France, 3e trimestre 2026',
        chemin: 'credit.tauxUsure',
      },
      {
        libelle: "Taux d'endettement signalé au-delà de",
        valeur: pct(hcsf.seuilEffort),
        source: 'Haut Conseil de stabilité financière, décision du 29 septembre 2021',
      },
      {
        libelle: 'Assurance emprunteur par défaut',
        valeur: `${pct(defauts.tauxAssurance)} du capital par an`,
        source: 'Spec Deklic',
      },
    ],
  };
}
