import type { Resultats } from '@loupe/moteur';
import { useLayoutEffect, useRef, useState, type JSX } from 'react';

import { rangerLibelles } from '@/analyses/reperes';
import { Carte, GrosChiffre, Pourquoi, TitreCarte } from '@/composants/ui';
import { nombre } from '@/formatage/nombres';
import { phrasePrixAffiche } from '@/textes/achat';
import { eurosArrondis, LIBELLES_CONFIANCE } from '@/textes/estimation';
import { EXPLICATIONS } from '@/textes/explications';
import { reponseCourte } from '@/textes/verdict';

function JaugePrix({ r }: { r: Resultats }): JSX.Element {
  const dvf = r.projet.marche.dvf;
  const prixM2 = r.achat.prixRetenu / r.projet.bien.surface;
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
  return (
    <Jauge
      prixM2={prixM2}
      reperes={[
        { valeur: q1, libelle: e === null ? nombre(q1) : `${nombre(q1)}, à rénover` },
        {
          valeur: centre,
          libelle:
            e === null ? `${nombre(centre)} €/m², le quartier` : `${nombre(centre)} €/m², estimé`,
        },
        { valeur: q3, libelle: e === null ? nombre(q3) : `${nombre(q3)}, rénové` },
      ]}
      description={
        e === null
          ? `Prix au m² ${nombre(prixM2)} € contre une médiane de ${nombre(dvf.medianM2)} €`
          : `Prix au m² ${nombre(prixM2)} € contre un prix estimé de ${nombre(centre)} €`
      }
    />
  );
}

/** Hauteur d'une ligne de libellés (text-xs + interligne), en pixels. */
const HAUTEUR_LIGNE = 16;

function Jauge({
  prixM2,
  reperes,
  description,
}: {
  prixM2: number;
  reperes: readonly { valeur: number; libelle: string }[];
  description: string;
}): JSX.Element {
  const valeurs = reperes.map((x) => x.valeur);
  const min = Math.min(...valeurs, prixM2) * 0.93;
  const max = Math.max(...valeurs, prixM2) * 1.07;
  const fraction = (v: number): number => (v - min) / (max - min);
  const pos = (v: number): string => `${String(fraction(v) * 100)}%`;

  // Les libellés trop proches (bien peu décoté : « à rénover » collé à « estimé ») passent
  // sur une ligne en dessous, d'après leur largeur réelle et celle de la jauge.
  const jauge = useRef<HTMLDivElement>(null);
  const libelles = useRef<(HTMLSpanElement | null)[]>([]);
  const [lignes, setLignes] = useState<number[]>(() => reperes.map(() => 0));
  const cle = reperes.map((x) => `${String(x.valeur)}:${x.libelle}`).join('|');
  useLayoutEffect(() => {
    const ranger = (): void => {
      const largeur = jauge.current?.clientWidth ?? 0;
      const suivantes = rangerLibelles(
        reperes.map((x, i) => ({
          centre: fraction(x.valeur) * largeur,
          largeur: libelles.current[i]?.offsetWidth ?? 0,
        })),
      );
      setLignes((avant) => (avant.join() === suivantes.join() ? avant : suivantes));
    };
    ranger();
    window.addEventListener('resize', ranger);
    return () => {
      window.removeEventListener('resize', ranger);
    };
    // `cle` résume repères et libellés : inutile de relancer à chaque rendu.
  }, [cle, min, max]);
  const lignesEnPlus = Math.max(0, ...lignes);

  return (
    <div
      ref={jauge}
      className="relative mx-2.5"
      style={{ height: 62 + lignesEnPlus * HAUTEUR_LIGNE }}
      role="img"
      aria-label={description}
    >
      <div className="absolute top-[22px] right-0 left-0 h-2.5 rounded-full bg-linear-to-r from-bon via-surveiller to-probleme opacity-35" />
      {reperes.map((x, i) => {
        const ligne = lignes[i] ?? 0;
        return (
          <div
            key={x.libelle}
            className="absolute top-[18px] flex flex-col items-center"
            style={{ left: pos(x.valeur), transform: 'translateX(-50%)' }}
          >
            <span className="w-0.5 bg-encre/40" style={{ height: 18 + ligne * HAUTEUR_LIGNE }} />
            <span
              ref={(el) => {
                libelles.current[i] = el;
              }}
              className="mt-1 text-xs whitespace-nowrap text-encre-3"
            >
              {x.libelle}
            </span>
          </div>
        );
      })}
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
      <p className="m-0 text-[15px] text-encre-2">{phrasePrixAffiche(r.achat)}</p>
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
