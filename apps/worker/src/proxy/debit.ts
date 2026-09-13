/** Contrat du binding « Rate Limiting » de Cloudflare ; une version mémoire sert au développement et aux tests. */
export interface LimiteurDebit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Fenêtre fixe : au plus `limite` appels par clé et par période. */
export function limiteurMemoire(
  limite: number,
  periodeSecondes: number,
  maintenant: () => number,
): LimiteurDebit {
  const compteurs = new Map<string, { fenetre: number; appels: number }>();
  return {
    limit: ({ key }) => {
      const fenetre = Math.floor(maintenant() / (periodeSecondes * 1000));
      const compteur = compteurs.get(key);
      if (compteur?.fenetre !== fenetre) {
        compteurs.set(key, { fenetre, appels: 1 });
        return Promise.resolve({ success: true });
      }
      compteur.appels += 1;
      return Promise.resolve({ success: compteur.appels <= limite });
    },
  };
}
