/** Mensualité constante d'un prêt amortissable (formule PMT). Taux 0 → capital / durée. */
export function calculerMensualite(capital: number, tauxAnnuel: number, dureeMois: number): number {
  if (capital <= 0 || dureeMois <= 0) return 0;
  const tauxMensuel = tauxAnnuel / 12;
  if (tauxMensuel === 0) return capital / dureeMois;
  return (capital * tauxMensuel) / (1 - (1 + tauxMensuel) ** -dureeMois);
}

/** Assurance emprunteur : proportion annuelle du capital initial, due chaque mois. */
export function assuranceMensuelle(capitalInitial: number, tauxAssuranceAnnuel: number): number {
  return (Math.max(0, capitalInitial) * tauxAssuranceAnnuel) / 12;
}
