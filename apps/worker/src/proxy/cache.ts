/** Cache clé → texte avec durée de vie, derrière KV en production et en mémoire en test. */
export interface Cache {
  lire(cle: string): Promise<string | null>;
  ecrire(cle: string, valeur: string, ttlSecondes: number): Promise<void>;
}

/** Le strict nécessaire d'un KVNamespace Cloudflare. */
export interface KvMinimal {
  get(cle: string, type: 'text'): Promise<string | null>;
  put(cle: string, valeur: string, options: { expirationTtl: number }): Promise<void>;
}

export function cacheKv(kv: KvMinimal): Cache {
  return {
    lire: (cle) => kv.get(cle, 'text'),
    ecrire: (cle, valeur, ttlSecondes) => kv.put(cle, valeur, { expirationTtl: ttlSecondes }),
  };
}

export function cacheMemoire(maintenant: () => number): Cache & { readonly taille: () => number } {
  const entrees = new Map<string, { valeur: string; expireA: number }>();
  return {
    taille: () => entrees.size,
    lire: (cle) => {
      const entree = entrees.get(cle);
      if (entree === undefined || entree.expireA <= maintenant()) {
        entrees.delete(cle);
        return Promise.resolve(null);
      }
      return Promise.resolve(entree.valeur);
    },
    ecrire: (cle, valeur, ttlSecondes) => {
      entrees.set(cle, { valeur, expireA: maintenant() + ttlSecondes * 1000 });
      return Promise.resolve();
    },
  };
}

/** JSON aux clés triées : deux requêtes équivalentes donnent le même texte. */
export function jsonCanonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(jsonCanonique).join(',')}]`;
  if (valeur !== null && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>;
    const cles = Object.keys(objet).sort();
    return `{${cles.map((k) => `${JSON.stringify(k)}:${jsonCanonique(objet[k])}`).join(',')}}`;
  }
  return JSON.stringify(valeur);
}

export async function empreinte(texte: string): Promise<string> {
  const condensat = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(condensat))
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('');
}

/** « geocodage:3f2a… » : le service, puis l'empreinte des paramètres validés. */
export async function cleCache(service: string, parametres: unknown): Promise<string> {
  return `${service}:${await empreinte(jsonCanonique(parametres))}`;
}
