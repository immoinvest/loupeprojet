/** Lecture des référentiels publiés (`data/`) : un fichier JSON par clé, `null` quand il n'existe pas. */
export interface LecteurDonnees {
  lireJson(cle: string): Promise<unknown>;
}

/** Le strict nécessaire d'un binding R2 Cloudflare. */
export interface R2Minimal {
  get(cle: string): Promise<{ json<T>(): Promise<T> } | null>;
}

export function lecteurR2(bucket: R2Minimal): LecteurDonnees {
  return {
    async lireJson(cle) {
      const objet = await bucket.get(cle);
      return objet === null ? null : await objet.json<unknown>();
    },
  };
}

/** Référentiels en mémoire, pour les tests : chaque lecture est notée. */
export function lecteurMemoire(
  fichiers: Readonly<Record<string, unknown>>,
): LecteurDonnees & { readonly lectures: string[] } {
  const lectures: string[] = [];
  return {
    lectures,
    lireJson(cle) {
      lectures.push(cle);
      return Promise.resolve(fichiers[cle] ?? null);
    },
  };
}
