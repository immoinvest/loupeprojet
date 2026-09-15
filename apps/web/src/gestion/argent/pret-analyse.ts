import {
  periodeDe,
  periodeSuivante,
  PretBienSchema,
  type BienGere,
  type PretBien,
} from '@loupe/gestion';
import { calculerFinancement, migrerProjet, obtenirRegles, ProjetSchema } from '@loupe/moteur';

/**
 * Le prêt que l'analyse avait prévu pour un bien venu de « J'ai acheté ce bien » (ADR-G27) : montant
 * emprunté, taux, durée et assurance calculés par le moteur sur l'instantané du projet ; première
 * échéance le mois qui suit l'achat. `null` sans instantané lisible, sans emprunt, ou hors des bornes.
 */
export function pretDepuisAnalyse(bien: BienGere): PretBien | null {
  if (bien.projet === undefined) return null;
  const projet = ProjetSchema.safeParse(migrerProjet(bien.projet));
  if (!projet.success) return null;
  const financement = calculerFinancement(projet.data, obtenirRegles(projet.data.versionRegles), {
    avecTaeg: false,
  });
  const { pret } = projet.data.hypotheses;
  const propose = PretBienSchema.safeParse({
    capital: Math.round(financement.montantEmprunte * 100),
    tauxAnnuel: pret.tauxNominal,
    dureeMois: pret.dureeAnnees * 12,
    debut: periodeSuivante(periodeDe(bien.creeLe.slice(0, 10))),
    assuranceMensuelle: Math.round(financement.assuranceMensuelle * 100),
  });
  return propose.success ? propose.data : null;
}
