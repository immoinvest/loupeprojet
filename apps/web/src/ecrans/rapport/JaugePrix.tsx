import type { Resultats } from '@loupe/moteur';
import type { JSX } from 'react';

import { nombre } from '@/formatage/nombres';

/** Prix au m² du bien placé sur la fourchette des ventes réelles autour de lui (quartiles DVF). */
export function JaugePrix({ r }: { r: Resultats }): JSX.Element {
  const dvf = r.projet.marche.dvf;
  const prixM2 = r.projet.hypotheses.achat.prix / r.projet.bien.surface;
  if (dvf === undefined) {
    return (
      <p className="m-0 text-[15px] text-encre-2">
        Pas de ventes réelles autour de ce bien pour l'instant.
      </p>
    );
  }
  const q1 = dvf.q1M2 ?? dvf.medianM2 * 0.88;
  const q3 = dvf.q3M2 ?? dvf.medianM2 * 1.12;
  const min = Math.min(q1, prixM2) * 0.93;
  const max = Math.max(q3, prixM2) * 1.07;
  const pos = (v: number): string => `${String(((v - min) / (max - min)) * 100)}%`;
  const repere = (v: number, libelle: string, retour = 'whitespace-nowrap'): JSX.Element => (
    <div
      key={libelle}
      className="absolute top-[18px] flex flex-col items-center"
      style={{ left: pos(v), transform: 'translateX(-50%)' }}
    >
      <span className="h-[18px] w-0.5 bg-encre/40" />
      <span className={`mt-1 text-xs text-encre-3 ${retour}`}>{libelle}</span>
    </div>
  );
  return (
    <div
      className="relative mx-2.5 h-[78px] sm:h-[62px] print:h-[62px]"
      role="img"
      aria-label={`Prix au m² ${nombre(prixM2)} € contre une médiane de ${nombre(dvf.medianM2)} €`}
    >
      <div className="absolute top-[22px] right-0 left-0 h-2.5 rounded-full bg-linear-to-r from-bon via-surveiller to-probleme opacity-35" />
      {repere(q1, nombre(q1))}
      {/* Sur téléphone, le repère du quartier passe sur deux lignes pour ne pas chevaucher ses voisins. */}
      {repere(
        dvf.medianM2,
        `${nombre(dvf.medianM2)} €/m², le quartier`,
        'max-w-20 text-center leading-tight sm:max-w-none sm:whitespace-nowrap print:max-w-none print:whitespace-nowrap',
      )}
      {repere(q3, nombre(q3))}
      <div
        className="absolute top-4 h-[22px] w-[22px] rounded-full border-4 border-surface bg-accent shadow-[0_0_0_2px_var(--color-accent)]"
        style={{ left: pos(prixM2), transform: 'translateX(-50%)' }}
      />
      <div
        className="absolute -top-2 text-[13px] font-bold whitespace-nowrap text-accent"
        style={{ left: pos(prixM2), transform: 'translateX(-50%)' }}
      >
        {nombre(prixM2)} €/m²
      </div>
    </div>
  );
}
