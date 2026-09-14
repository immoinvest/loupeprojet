/** Explications longues, écrites une fois, affichées derrière « Pourquoi ? ». */
export const EXPLICATIONS = {
  prix: "On compare au prix estimé du bien, calculé sur les ventes signées chez le notaire (base DVF) ramenées à aujourd'hui, pas aux prix affichés dans les annonces, qui sont 5 à 10 % au-dessus du prix final. L'état, l'étage, le DPE, le balcon et les charges ajustent l'estimation ; l'onglet Estimation montre chaque vente et chaque source.",
  cashflow:
    "Le cash-flow retient toutes les charges : crédit et assurance, taxe foncière, copropriété, assurance propriétaire, comptable, CFE, provision d'entretien, et les semaines sans locataire. C'est ce que les annonces oublient.",
  fiscalite:
    "Chaque régime est projeté année par année sur la durée de détention, avec les déficits et amortissements reportés. Au réel meublé, l'amortissement ne peut pas créer de déficit : l'excédent est mis en réserve sans limite de temps.",
  revente:
    "Valeur estimée à la revente, moins l'agence, le capital restant dû, l'indemnité de remboursement anticipé et l'impôt sur la plus-value. Depuis 2025, les amortissements du meublé au réel sont réintégrés dans la plus-value.",
  leviers:
    'Le prix de négociation est celui qui met le cash-flow à zéro avec vos hypothèses. La colocation majore le loyer total de 35 % et compte un mois de vacance par an.',
} as const;
