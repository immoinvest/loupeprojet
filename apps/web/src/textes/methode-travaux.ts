import type { FourchetteM2, Regles } from '@loupe/moteur';

import { euros } from '@/formatage/nombres';

import { LIBELLES_ETATS } from './estimation';
import { pct, type SectionMethode } from './methode-commun';

/** « 400 €/m² (150 à 700) ». */
function coutM2(f: FourchetteM2): string {
  if (f.haut === 0) return '0 €/m²';
  return `${euros(f.estime)}/m² (${euros(f.bas)} à ${euros(f.haut)})`;
}

export function sectionTravaux(regles: Regles): SectionMethode {
  const t = regles.travaux;
  const energie = t.renovationEnergetique;
  const classes = energie.classes.join(' ou ');
  return {
    code: 'travaux',
    titre: 'Les travaux',
    resume:
      "Un ordre de grandeur selon l'état du bien, hors aides, à confirmer par devis ; jamais un devis.",
    etapes: [
      "État connu : surface × coût au m² de l'état. État inconnu : aucune estimation.",
      `DPE ${classes} : rénovation énergétique en plus (isolation, chauffage, ventilation) ; ${pct(energie.partSiARenover)} du supplément pour un bien à rénover, dont la rénovation complète couvre une partie.`,
      `Fourchette : bas et haut du barème ; montants arrondis à ${euros(t.arrondi)}. TTC, sans les aides (MaPrimeRénov' dépend des revenus), sans coefficient pour une maison ni pour la région.`,
      "Le montant suit l'état, la surface et le DPE tant qu'il n'est pas saisi ; bas, estimé ou haut en un clic. Les projets créés avant ce barème gardent leurs travaux.",
      "Un bien à rénover se vend moins cher : l'estimation du prix le place dans le bas des ventes comparables, et les travaux restent à payer. Les deux sont comptés.",
    ],
    constantes: [
      ...(['a_renover', 'a_rafraichir', 'bon_etat', 'renove'] as const).map((etat) => ({
        libelle: `Travaux, ${LIBELLES_ETATS[etat].toLowerCase()}`,
        valeur: coutM2(t.parEtat[etat]),
        source:
          "Fourchettes publiques de professionnels du bâtiment relevées le 14/09/2026 (Co'Building, Groupe R, Adora Économie, La Maison Saint-Gobain, Renovation-artisan) ; aucun barème officiel",
        chemin: 'travaux.parEtat',
      })),
      {
        libelle: `Rénovation énergétique, DPE ${classes}`,
        valeur: coutM2(energie),
        source:
          "Fourchettes attribuées à l'ADEME par Travaux.com, Selectra et OneDPE (publication d'origine non retrouvée) ; ANAH : 55 065 € par rénovation d'ampleur en 2024",
        chemin: 'travaux.renovationEnergetique',
      },
    ],
  };
}
