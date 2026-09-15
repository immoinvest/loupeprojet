export const LETTRES_ENERGIE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type LettreEnergie = (typeof LETTRES_ENERGIE)[number];

/** `dpe` : étiquette énergie (vert → rouge) ; `ges` : émissions de gaz à effet de serre (mauve). */
export type VarianteEnergie = 'dpe' | 'ges';

/**
 * Fond et texte de chaque lettre, aux couleurs des étiquettes (tokens `--color-dpe-*`, `--color-ges-*`
 * de `index.css`). Classes écrites en entier pour que Tailwind les trouve.
 */
const CLASSES: Readonly<Record<VarianteEnergie, Readonly<Record<LettreEnergie, string>>>> = {
  dpe: {
    A: 'bg-dpe-a text-encre',
    B: 'bg-dpe-b text-encre',
    C: 'bg-dpe-c text-encre',
    D: 'bg-dpe-d text-encre',
    E: 'bg-dpe-e text-encre',
    F: 'bg-dpe-f text-encre',
    G: 'bg-dpe-g text-white',
  },
  ges: {
    A: 'bg-ges-a text-encre',
    B: 'bg-ges-b text-encre',
    C: 'bg-ges-c text-encre',
    D: 'bg-ges-d text-encre',
    E: 'bg-ges-e text-white',
    F: 'bg-ges-f text-white',
    G: 'bg-ges-g text-white',
  },
};

export function classesLettre(variante: VarianteEnergie, lettre: LettreEnergie): string {
  return CLASSES[variante][lettre];
}

export function estLettreEnergie(valeur: string): valeur is LettreEnergie {
  return (LETTRES_ENERGIE as readonly string[]).includes(valeur);
}
