/**
 * Le favori que l'utilisateur garde dans sa barre : quelques centaines d'octets qui chargent
 * `capture.js` depuis Deklic au moment du clic. Ainsi le favori reste petit (un favori de 166 Ko
 * ne se laisse pas glisser dans tous les navigateurs) et les règles de lecture se mettent à jour
 * sans le refaire. Si le site de l'annonce bloque les scripts externes, une alerte le dit.
 */
export const NOM_FAVORI = 'Analyser dans Deklic';

export const MESSAGE_SITE_BLOQUANT =
  "Deklic : ce site bloque le chargement du favori. Utilisez l'extension Deklic, ou collez le texte de l'annonce dans Deklic.";

/** URL `javascript:` du favori, pour l'origine de Deklic donnée (production ou aperçu). */
export function codeFavori(origine: string): string {
  const source = `${origine.replace(/\/+$/, '')}/capture.js`;
  const script = [
    '(function(){',
    'var d=document,s=d.createElement("script");',
    `s.src=${JSON.stringify(source)}+"?"+Date.now();`,
    `s.onerror=function(){alert(${JSON.stringify(MESSAGE_SITE_BLOQUANT)})};`,
    '(d.head||d.documentElement).appendChild(s)',
    '})();',
  ].join('');
  return `javascript:${encodeURIComponent(script)}`;
}
