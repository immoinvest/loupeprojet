import type { Regles } from '@loupe/moteur';

import { euros } from '@/formatage/nombres';

import { pct, type SectionMethode } from './methode-commun';

const EXCEL =
  'Excel « Projet 92K » de Pierre, lu le 14/09/2026 ; valeur d’un projet, pas une statistique';
const CHOIX = 'Choix Deklic sans source publique';

/**
 * Les cinq types d'exploitation : ce qui fait la recette, ce qui la mange, et d'où viennent les valeurs
 * de départ. Tout est lu dans les règles datées.
 */
export function sectionLocation(regles: Regles): SectionMethode {
  const {
    parType: t,
    primeColocation,
    primeMeuble,
    colocation,
    meubleTourisme,
    bailMobilite,
  } = regles.exploitation;
  const { microBic } = regles.fiscalite;
  const racine = 'exploitation.parType';
  return {
    code: 'location',
    titre: 'Les types de location',
    resume:
      'Le type choisi décide des recettes, des charges propres et des régimes fiscaux possibles. Ses valeurs de départ sont marquées « estimé » et se changent dans Hypothèses.',
    etapes: [
      `Location nue : loyer × 12 − vacance (${String(t.nu.vacanceSemaines)} semaines par défaut) ; les quatre régimes sont comparés.`,
      `Meublée longue durée : loyer × 12 − vacance (${String(t.meuble.vacanceSemaines)} semaines, 8 à 10 pour un logement étudiant : à saisir) ; loyer nu déduit par ÷ (1 + ${pct(primeMeuble)}) pour comparer les régimes nus.`,
      `Colocation : chambres louées × loyer par chambre × 12, plus le forfait de charges comprises ; vacance de ${String(t.colocation.vacanceSemaines)} semaines par chambre ; énergie et internet payés par le propriétaire. Régimes du meublé seulement.`,
      `Courte durée : nuitée × nuits louées par mois × 12, plus le ménage facturé ; séjours = nuits ÷ durée d'un séjour ; ménage payé par séjour, commission de plateforme et conciergerie en charges. Micro-BIC à ${pct(microBic.abattementTourismeNonClasse)} d'abattement et ${euros(microBic.plafondTourismeNonClasse)} de plafond si le meublé de tourisme n'est pas classé, ${pct(microBic.abattement)} et ${euros(microBic.plafond)} s'il l'est.`,
      `Moyenne durée (bail mobilité, ${String(bailMobilite.dureeMinMois)} à ${String(bailMobilite.dureeMaxMois)} mois) : loyer et forfait de charges × 12, vacance entre deux séjours, ménage par séjour. Régimes du meublé seulement.`,
      'Changer de type dans Hypothèses repart du loyer meublé équivalent : colocation × (1 + prime colocation) ÷ chambres, nuitée = deux loyers journaliers.',
    ],
    constantes: [
      {
        libelle: 'Colocation : supplément de loyer total',
        valeur: `+${pct(primeColocation)}`,
        source: 'Spec Deklic (+30 à +45 % observés)',
      },
      {
        libelle: 'Colocation : surface et volume minimaux d’une chambre',
        valeur: `${String(colocation.surfaceMinChambreM2)} m² · ${String(colocation.volumeMinChambreM3)} m³`,
        source: 'Loi n° 89-462 art. 8-1 ; décret n° 2002-120',
      },
      {
        libelle: 'Énergie payée par le propriétaire (colocation, courte et moyenne durée)',
        valeur: `${euros(t.colocation.energieMensuel)} par mois`,
        source: EXCEL,
        chemin: `${racine}.colocation.energieMensuel`,
      },
      {
        libelle: 'Internet et TV payés par le propriétaire',
        valeur: `${euros(t.colocation.internetMensuel)} par mois`,
        source: EXCEL,
        chemin: `${racine}.colocation.internetMensuel`,
      },
      {
        libelle: 'Courte durée : nuits louées par mois',
        valeur: String(t.courte_duree.nuiteesParMois),
        source: EXCEL,
        chemin: `${racine}.courte_duree.nuiteesParMois`,
      },
      {
        libelle: 'Courte durée : durée d’un séjour',
        valeur: `${String(t.courte_duree.dureeSejourNuits)} nuits`,
        source: EXCEL,
        chemin: `${racine}.courte_duree.dureeSejourNuits`,
      },
      {
        libelle: 'Courte durée : ménage par séjour (facturé et payé)',
        valeur: euros(t.courte_duree.menageParSejour),
        source: EXCEL,
        chemin: `${racine}.courte_duree.menageParSejour`,
      },
      {
        libelle: 'Courte durée : commission de la plateforme',
        valeur: pct(t.courte_duree.plateformeTaux),
        source:
          'Airbnb, centre d’aide art. 1857 (lu le 14/09/2026) : 3 % en frais partagés, 15,5 % en frais uniques',
        chemin: `${racine}.courte_duree.plateformeTaux`,
      },
      {
        libelle: 'Courte durée : nuitée de départ',
        valeur: `${String(t.courte_duree.nuiteeEnLoyersJournaliers)} loyers journaliers`,
        source: CHOIX,
        chemin: `${racine}.courte_duree.nuiteeEnLoyersJournaliers`,
      },
      {
        libelle: 'Meublé de tourisme : classe DPE minimale',
        valeur: `${meubleTourisme.dpeMinNouvelleAutorisation} pour une nouvelle autorisation · ${meubleTourisme.dpeMinTous} pour tous dès ${String(meubleTourisme.dpeMinTousDes)}`,
        source: 'Loi n° 2024-1039 du 19/11/2024',
      },
      {
        libelle: 'Résidence principale louée en courte durée',
        valeur: `${String(meubleTourisme.joursMaxResidencePrincipale)} jours par an au plus`,
        source: 'Loi n° 2024-1039 du 19/11/2024 ; les communes peuvent abaisser à 90 jours',
      },
      {
        libelle: 'Moyenne durée : vacance entre deux séjours',
        valeur: `${String(t.moyenne_duree.vacanceSemaines)} semaines par an`,
        source: CHOIX,
        chemin: `${racine}.moyenne_duree.vacanceSemaines`,
      },
      {
        libelle: 'Moyenne durée : durée d’un séjour',
        valeur: `${String(t.moyenne_duree.dureeSejourMois)} mois`,
        source: CHOIX,
        chemin: `${racine}.moyenne_duree.dureeSejourMois`,
      },
    ],
  };
}
