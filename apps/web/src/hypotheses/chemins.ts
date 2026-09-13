/** Accès par chemin pointé (« hypotheses.pret.tauxNominal ») à un objet JSON. */
type Objet = Readonly<Record<string, unknown>>;

function estObjet(v: unknown): v is Objet {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function lireChemin(objet: unknown, chemin: string): unknown {
  let courant: unknown = objet;
  for (const segment of chemin.split('.')) {
    if (!estObjet(courant)) return undefined;
    courant = courant[segment];
  }
  return courant;
}

/**
 * Copie immuable avec la valeur écrite au chemin donné. Les objets intermédiaires
 * manquants sont créés ; `undefined` supprime la clé (utile pour les champs optionnels).
 */
export function ecrireChemin<T extends Objet>(objet: T, chemin: string, valeur: unknown): T {
  const segments = chemin.split('.');
  const ecrire = (courant: unknown, index: number): Objet => {
    const base: Objet = estObjet(courant) ? courant : {};
    const segment = String(segments[index]);
    if (index === segments.length - 1) {
      if (valeur === undefined) {
        return Object.fromEntries(Object.entries(base).filter(([k]) => k !== segment));
      }
      return { ...base, [segment]: valeur };
    }
    return { ...base, [segment]: ecrire(base[segment], index + 1) };
  };
  return ecrire(objet, 0) as T;
}
