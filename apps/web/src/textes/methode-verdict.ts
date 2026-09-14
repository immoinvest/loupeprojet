import type { Regles } from '@loupe/moteur';

import type { Defauts } from '@/analyses';
import { euros, nombre } from '@/formatage/nombres';

import { EXPLICATIONS } from './explications';
import { pct, pctSigne, type SectionMethode } from './methode-commun';

export function sectionTri(): SectionMethode {
  return {
    code: 'tri',
    titre: "Le TRI et l'enrichissement",
    resume: 'Le vrai rendement de votre argent, revente comprise.',
    etapes: [
      'Flux annuels : − (apport + mobilier) au départ, puis le cash-flow après impôt du régime retenu chaque année, plus le cash net de revente la dernière année.',
      'TRI = le taux qui annule la valeur actuelle nette de ces flux, résolu numériquement ; absent quand les flux sont tous de même signe.',
      'Enrichissement = cash net de revente + cash-flows cumulés − mise de départ, soit aussi capital remboursé + plus-value nette + cash-flows cumulés.',
    ],
    constantes: [],
  };
}

export function sectionVerdict(regles: Regles): SectionMethode {
  const v = regles.verdict;
  const dpe = regles.exploitation.interdictionLocationDpe;
  return {
    code: 'verdict',
    titre: 'Le verdict : cinq feux',
    resume: 'Pas de note globale : cinq lectures séparées, chacune avec ses seuils.',
    etapes: [
      `Prix : écart du prix au m² retenu (négocié) au prix au m² estimé du bien (voir l'estimation), calculé sur les ventes réelles (DVF). Bon jusqu'à ${pctSigne(v.prix.bonJusqua)}, à surveiller jusqu'à ${pctSigne(v.prix.surveillerJusqua)}, problème au-delà ; inconnu sans ventes autour du bien.`,
      `Rendement net : bon dès ${pct(v.rendementNet.bonDes)}, à surveiller dès ${pct(v.rendementNet.surveillerDes)}, problème en dessous.`,
      `Cash-flow mensuel : bon dès ${euros(v.cashflowMensuel.bonDes)}, à surveiller dès ${euros(v.cashflowMensuel.surveillerDes)}, problème en dessous.`,
      `Effort bancaire : bon jusqu'à ${pct(v.effort.bonJusqua)}, à surveiller jusqu'à ${pct(v.effort.surveillerJusqua)}, problème au-delà ; inconnu sans revenus.`,
      `Risques : DPE F ou G = problème (location interdite dès ${String(dpe.G)} pour G, ${String(dpe.F)} pour F) ; DPE E (interdit dès ${String(dpe.E)}), copropriété en procédure ou risque naturel fort = à surveiller.`,
      "Sous les feux, le rapport liste ce qui se règle avant l'offre : effort au-dessus du seuil, prêt trop long, plafond du micro dépassé, loyer au-dessus de l'encadrement, prélèvements sociaux à confirmer. L'onglet Visite tire ses questions d'une base sourcée (ANIL, Notaires de France, Service-public.fr, textes de loi) filtrée par le bien : copropriété, année de construction, DPE, étage, mode d'exploitation, risques, travaux, prix.",
    ],
    constantes: [
      {
        libelle: 'Seuils du feu prix',
        valeur: `bon jusqu'à ${pctSigne(v.prix.bonJusqua)} · à surveiller jusqu'à ${pctSigne(v.prix.surveillerJusqua)}`,
        source: 'Choix Deklic',
      },
      {
        libelle: 'Seuils du feu rendement net',
        valeur: `bon dès ${pct(v.rendementNet.bonDes)} · à surveiller dès ${pct(v.rendementNet.surveillerDes)}`,
        source: 'Choix Deklic',
      },
      {
        libelle: 'Seuils du feu cash-flow',
        valeur: `bon dès ${euros(v.cashflowMensuel.bonDes)} · à surveiller dès ${euros(v.cashflowMensuel.surveillerDes)} par mois`,
        source: 'Choix Deklic',
      },
      {
        libelle: 'Seuils du feu effort',
        valeur: `bon jusqu'à ${pct(v.effort.bonJusqua)} · à surveiller jusqu'à ${pct(v.effort.surveillerJusqua)}`,
        source: 'Choix Deklic, alignés sur le seuil du HCSF',
      },
      {
        libelle: 'Interdiction de louer selon le DPE',
        valeur: `G dès ${String(dpe.G)} · F dès ${String(dpe.F)} · E dès ${String(dpe.E)}`,
        source: 'Loi Climat et résilience du 22 août 2021, art. 160',
        chemin: 'exploitation.interdictionLocationDpe',
      },
    ],
  };
}

export function sectionScenarios(regles: Regles): SectionMethode {
  const e = regles.exploitation;
  return {
    code: 'scenarios',
    titre: 'Les scénarios « et si »',
    resume: EXPLICATIONS.leviers,
    etapes: [
      'Négocier : le prix qui met le cash-flow à zéro avec vos hypothèses (à défaut, −10 % du prix retenu) ; trois prix cibles : cash-flow nul, rendement net 6 %, rendement brut 8 %.',
      `Colocation : loyer total +${pct(e.primeColocation)}, ${String(e.vacanceSemainesColocation)} semaines de vacance, en meublé, sans travaux d'aménagement.`,
      'Durée du prêt : 20 ans (15 ans si le prêt fait déjà 20 ans). Taux : +0,5 point.',
      `Passer en nu ou en meublé : loyer ÷ ou × (1 + ${pct(e.primeMeuble)}), avec le régime réel correspondant.`,
      "Deux mois vides par an : 8 semaines de vacance ; en courte durée, 15 points d'occupation en moins.",
      "Chaque scénario recalcule tout le projet ; le rapport montre l'écart avec la référence.",
    ],
    constantes: [
      {
        libelle: 'Repli de négociation, durées alternatives, hausse de taux, vacance longue',
        valeur:
          '−10 % du prix retenu · 20 ou 15 ans · +0,5 point · 8 semaines (−15 points d’occupation en courte durée)',
        source: 'Scénarios prédéfinis du moteur (packages/moteur, scenarios/predefinis.ts)',
      },
    ],
  };
}

export function sectionDefauts(defauts: Defauts): SectionMethode {
  const d = defauts;
  return {
    code: 'defauts',
    titre: 'Les valeurs par défaut',
    resume:
      'Jamais de case vide : quand une donnée manque, une valeur sourcée la remplace, avec son badge. Toutes se changent dans Hypothèses.',
    etapes: [],
    constantes: [
      {
        libelle: 'Vacance locative',
        valeur: `${String(d.vacanceSemaines)} semaines par an`,
        source: 'Spec Deklic',
      },
      {
        libelle: "Provision d'entretien",
        valeur: `${pct(d.entretienTaux)} du prix par an`,
        source: 'Spec Deklic',
      },
      {
        libelle: 'Assurance emprunteur',
        valeur: `${pct(d.tauxAssurance)} du capital par an`,
        source: 'Spec Deklic (0,10 à 0,35 % selon l’âge)',
      },
      {
        libelle: 'Négociation du prix affiché',
        valeur: `${pct(d.negociationTaux)} : prix affiché retenu tel quel`,
        source: 'Curseur de 0 à −15 % dans Hypothèses ; le prix retenu sert à tout le rapport',
      },
      {
        libelle: "Honoraires d'agence",
        valeur: d.honorairesChargeAcquereur
          ? "à la charge de l'acquéreur"
          : 'à la charge du vendeur',
        source: 'Usage des annonces « frais d’agence inclus »',
      },
      {
        libelle: 'Taxe foncière inconnue',
        valeur: `${nombre(d.taxeFonciereEnMoisDeLoyer)} mois de loyer`,
        source: 'Spec Deklic (0,8 à 1,2 mois de loyer)',
      },
      {
        libelle: 'Charges de copropriété inconnues',
        valeur: `${euros(d.coproParM2An)} par m² et par an`,
        source: 'Ordre de grandeur, spec Deklic',
      },
      {
        libelle: 'Assurance propriétaire non occupant',
        valeur: `${euros(d.pno)} par an`,
        source: 'Barème intégré',
      },
      {
        libelle: 'Comptable (réel meublé) et CFE (meublé)',
        valeur: `${euros(d.comptable)} · ${euros(d.cfe)} par an`,
        source: 'Barème intégré',
      },
      {
        libelle: 'Frais de dossier et garantie du prêt',
        valeur: `${euros(d.fraisDossier)} · ${euros(d.fraisGarantie)}`,
        source: 'Barème intégré',
      },
      {
        libelle: 'Mobilier (meublé)',
        valeur: `${euros(d.mobilierParM2)} par m²`,
        source: 'Barème intégré',
      },
      {
        libelle: 'Nombre de pièces inconnu',
        valeur: `une pièce pour ${nombre(d.surfaceParPiece)} m²`,
        source: 'Déduit de la surface, spec Deklic',
      },
      {
        libelle: 'Revente envisagée',
        valeur: `${String(d.reventeAnnees)} ans · +${pct(d.evolutionAnnuelle)} par an · agence ${pct(d.fraisAgenceTaux)} · diagnostics ${euros(d.diagnostics)}`,
        source: 'Spec Deklic',
      },
      {
        libelle: 'Prélèvements sociaux',
        valeur: `${pct(d.psBic)} en meublé · ${pct(d.psFoncier)} en nu`,
        source: 'Voir les régimes ci-dessus',
      },
    ],
  };
}
