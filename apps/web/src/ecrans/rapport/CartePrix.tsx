import type { Resultats } from '@loupe/moteur';
import type { JSX } from 'react';

import { Carte, GrosChiffre, Pourquoi, TitreCarte } from '@/composants/ui';
import { nombre } from '@/formatage/nombres';
import { eurosArrondis, LIBELLES_CONFIANCE } from '@/textes/estimation';
import { EXPLICATIONS } from '@/textes/explications';
import { reponseCourte } from '@/textes/verdict';

function JaugePrix({ r }: { r: Resultats }): JSX.Element {
  const dvf = r.projet.marche.dvf;
  const prixM2 = r.projet.hypotheses.achat.prix / r.projet.bien.surface;
  if (dvf === undefined) {
    return (
      <p className="m-0 text-[15px] text-encre-2">
        Pas de ventes réelles autour de ce bien pour l'instant.
      </p>
    );
  }
  // Avec une estimation : les bornes sont le même bien à rénover et rénové, le centre son prix estimé.
  const e = r.estimation;
  const surface = r.projet.bien.surface;
  const q1 = e === null ? (dvf.q1M2 ?? dvf.medianM2 * 0.88) : e.selonEtat.a_renover / surface;
  const q3 = e === null ? (dvf.q3M2 ?? dvf.medianM2 * 1.12) : e.selonEtat.renove / surface;
  const centre = e === null ? dvf.medianM2 : e.prixM2Estime;
  const min = Math.min(q1, prixM2) * 0.93;
  const max = Math.max(q3, prixM2) * 1.07;
  const pos = (v: number): string => `${String(((v - min) / (max - min)) * 100)}%`;
  const repere = (v: number, libelle: string): JSX.Element => (
    <div
      key={libelle}
      className="absolute top-[18px] flex flex-col items-center"
      style={{ left: pos(v), transform: 'translateX(-50%)' }}
    >
      <span className="h-[18px] w-0.5 bg-encre/40" />
      <span className="mt-1 text-xs whitespace-nowrap text-encre-3">{libelle}</span>
    </div>
  );
  return (
    <div
      className="relative mx-2.5 h-[62px]"
      role="img"
      aria-label={
        e === null
          ? `Prix au m² ${nombre(prixM2)} € contre une médiane de ${nombre(dvf.medianM2)} €`
          : `Prix au m² ${nombre(prixM2)} € contre un prix estimé de ${nombre(centre)} €`
      }
    >
      <div className="absolute top-[22px] right-0 left-0 h-2.5 rounded-full bg-linear-to-r from-bon via-surveiller to-probleme opacity-35" />
      {repere(q1, e === null ? nombre(q1) : `${nombre(q1)}, à rénover`)}
      {repere(
        centre,
        e === null ? `${nombre(centre)} €/m², le quartier` : `${nombre(centre)} €/m², estimé`,
      )}
      {repere(q3, e === null ? nombre(q3) : `${nombre(q3)}, rénové`)}
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

/** « Est-ce que c'est cher ? » : le feu prix, la jauge et la fourchette d'estimation. */
export function CartePrix({ r }: { r: Resultats }): JSX.Element {
  const feu = r.verdict.feux.find((f) => f.axe === 'prix')?.feu ?? 'inconnu';
  const reponse = feu === 'bon' ? 'non' : feu === 'surveiller' ? 'presque' : 'oui';
  const n = r.projet.marche.dvf?.nombreVentes ?? 0;
  return (
    <Carte>
      <TitreCarte action={<Pourquoi texte={EXPLICATIONS.prix} />}>
        Est-ce que c'est cher ?
      </TitreCarte>
      {feu === 'inconnu' ? (
        <GrosChiffre ton="encre">On ne sait pas.</GrosChiffre>
      ) : (
        <GrosChiffre ton={feu === 'bon' ? 'bon' : feu === 'surveiller' ? 'surveiller' : 'probleme'}>
          {reponseCourte(reponse)}
        </GrosChiffre>
      )}
      <JaugePrix r={r} />
      {r.estimation !== null && (
        <p className="m-0 text-[15px] leading-relaxed text-encre-2">
          Estimé entre <strong>{eurosArrondis(r.estimation.bas)}</strong> et{' '}
          <strong>{eurosArrondis(r.estimation.haut)}</strong> ·{' '}
          {LIBELLES_CONFIANCE[r.estimation.confiance].toLowerCase()}.
        </p>
      )}
      {n > 0 && (
        <p className="m-0 text-[15px] leading-relaxed text-encre-2">
          {n} ventes réelles autour du bien.{' '}
          {feu === 'bon'
            ? 'Un prix aussi bas se vérifie en visite : pourquoi le vendeur baisse ?'
            : ''}
        </p>
      )}
    </Carte>
  );
}
