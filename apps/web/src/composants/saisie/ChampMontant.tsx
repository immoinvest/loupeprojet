import { useLayoutEffect, useRef, type JSX } from 'react';

import { useModeDocument } from '@/composants/document';

import { formaterMontant, nettoyerMontant, positionApres, significatifsAvant } from './montant';

export interface PropsChampMontant {
  /** Id de la saisie : le libellé du champ la nomme par `htmlFor`. */
  readonly id: string;
  readonly nom?: string | undefined;
  /** La chaîne brute gardée par l'appelant : « 155000 », « 32,5 », `''`. */
  readonly valeur: string;
  readonly onChange: (brut: string) => void;
  /** « € », « m² », « €/mois » : affiché à droite de la saisie. */
  readonly unite?: string | undefined;
  /** Chiffres après la virgule acceptés (défaut 0). */
  readonly decimales?: number;
  readonly decritPar?: string | undefined;
  readonly invalide?: boolean;
}

/**
 * Un montant précis : pavé numérique, milliers espacés pendant la frappe (« 155 000 »), curseur de texte
 * gardé au même chiffre. L'appelant ne voit que la chaîne brute, sans espaces ni lettres.
 */
export function ChampMontant({
  id,
  nom,
  valeur,
  onChange,
  unite,
  decimales = 0,
  decritPar,
  invalide = false,
}: PropsChampMontant): JSX.Element {
  const document = useModeDocument();
  const ref = useRef<HTMLInputElement>(null);
  // Chiffres situés avant le curseur au moment de la frappe : replacés après la mise en forme.
  const curseur = useRef<number | null>(null);
  const affiche = formaterMontant(valeur);

  useLayoutEffect(() => {
    const champ = ref.current;
    const avant = curseur.current;
    curseur.current = null;
    if (champ === null || avant === null || window.document.activeElement !== champ) return;
    const position = positionApres(champ.value, avant);
    champ.setSelectionRange(position, position);
  });

  if (document) {
    return (
      <span className="text-[15px] font-semibold">
        {valeur === '' ? '—' : `${affiche}${unite === undefined ? '' : ` ${unite}`}`}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <input
        ref={ref}
        id={id}
        name={nom}
        value={affiche}
        inputMode={decimales > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        aria-describedby={decritPar}
        aria-invalid={invalide}
        onChange={(e) => {
          const { value, selectionStart } = e.currentTarget;
          curseur.current = significatifsAvant(value, selectionStart ?? value.length);
          onChange(nettoyerMontant(value, decimales));
        }}
        className={`min-h-[44px] w-full min-w-0 rounded-encart border bg-surface px-3 text-[15px] font-semibold pointer-coarse:text-base ${
          invalide ? 'border-probleme' : 'border-bordure'
        }`}
      />
      {unite !== undefined && (
        <span className="text-xs whitespace-nowrap text-encre-3">{unite}</span>
      )}
    </span>
  );
}
