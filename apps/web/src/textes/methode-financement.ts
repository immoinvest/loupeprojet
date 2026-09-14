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
      "Calculés par la formule réelle sur le prix retenu (négocié) hors honoraires d'agence, pas au forfait de 8 %.",
    etapes: [
      "Prix retenu = prix affiché × (1 − négociation), arrondi à l'euro ; sans négociation, le prix affiché tel quel. Les honoraires d'agence restent en euros.",
      "Base = prix retenu − honoraires d'agence quand ils sont à votre charge.",
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
    resume:
      'Mensualité constante, coût complet du crédit, et la part du loyer que prend le crédit.',
    etapes: [
      "Emprunt = prix retenu + travaux + frais d'acquisition + frais de dossier + garantie − apport. Le mobilier n'est pas financé : mise de départ = apport + mobilier.",
      "Mensualité constante (formule PMT) sur le taux nominal ; assurance = capital emprunté × taux d'assurance ÷ 12, chaque mois.",
      'Différé total : intérêts capitalisés, aucune mensualité ; différé partiel : intérêts seuls. La mensualité de croisière est recalculée après le différé.',
      "TAEG : le taux qui égalise le capital net des frais et toutes les mensualités, résolu numériquement, avec et sans assurance ; comparé au taux d'usure.",
      'Crédit ÷ loyer = mensualité assurance comprise ÷ loyer hors charges : dit si le loyer porte le crédit sans connaître vos revenus.',
      `Deklic ne demande pas vos revenus : la banque calculera votre taux d'effort avec ${pct(hcsf.partLoyers)} des loyers, seuil ${pct(hcsf.seuilEffort)} ; durée maximale ${dureeMax}.`,
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
      'Colocation : loyer par chambre × chambres louées × 12, plus les forfaits de charges comprises ; la vacance vaut pour chaque chambre. Courte durée : nuitée × nuits louées par mois × 12, plus le ménage facturé aux voyageurs ; la vacance est déjà dans les nuitées. Moyenne durée : loyer et forfait de charges × 12, vacance entre deux séjours.',
      `Charges pleines : taxe foncière, copropriété, assurance propriétaire, comptable (réel meublé), CFE (meublé), gestion (% des loyers), conciergerie et commission de plateforme (% des recettes), ménage payé par séjour, énergie et internet payés par le propriétaire, entretien (${pct(defauts.entretienTaux)} du prix par an).`,
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
        valeur: `+${pct(e.primeColocation)} · ${String(e.parType.colocation.vacanceSemaines)} semaines par an et par chambre`,
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
      "Trois lectures du même bien, toutes sur le coût complet : prix retenu + travaux + frais d'acquisition.",
    etapes: [
      'Brut = loyers annuels hors charges ÷ coût complet.',
      'Net = (loyers nets de vacance − charges pleines) ÷ coût complet.',
      'Net-net = (loyers nets − charges − intérêts − assurance − impôt de la première année) ÷ coût complet.',
    ],
    constantes: [],
  };
}
