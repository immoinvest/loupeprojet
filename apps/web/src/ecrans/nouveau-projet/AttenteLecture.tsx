import type { Portail } from '@loupe/capture';
import { useEffect, useState, type JSX } from 'react';

import { etatAttente, indiceAstuce } from '@/annonces/attente';
import { Bouton, Carte } from '@/composants/ui';
import { ASTUCES_ATTENTE, ETAPES_ATTENTE, TEXTES_ATTENTE } from '@/textes/attente';
import { NOMS_PORTAILS } from '@/textes/lecture-serveur';

/** Assez souvent pour que la barre et le compteur avancent sans à-coups visibles. */
export const RAFRAICHISSEMENT_MS = 500;

const horloge = (): number => Date.now();

/**
 * L'attente d'une lecture par le serveur (5 à 75 s) : l'étape en cours, une progression estimée
 * d'après la durée habituelle du portail, le temps écoulé, une astuce, et de quoi abandonner.
 * Seul le changement d'étape est annoncé aux lecteurs d'écran.
 */
export function AttenteLecture({
  portail,
  debut,
  annuler,
  maintenant = horloge,
}: {
  portail: Portail;
  /** Instant du début de la lecture (ms). */
  debut: number;
  annuler: () => void;
  maintenant?: () => number;
}): JSX.Element {
  const [ecoule, setEcoule] = useState(() => Math.max(0, maintenant() - debut));

  useEffect(() => {
    const minuterie = setInterval(() => {
      setEcoule(Math.max(0, maintenant() - debut));
    }, RAFRAICHISSEMENT_MS);
    return () => {
      clearInterval(minuterie);
    };
  }, [debut, maintenant]);

  const nom = NOMS_PORTAILS[portail];
  const { progression, etape } = etatAttente(ecoule, portail);
  const pourcent = Math.round(progression * 100);
  const astuce = ASTUCES_ATTENTE[indiceAstuce(ecoule, ASTUCES_ATTENTE.length)];

  return (
    <Carte>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent motion-safe:animate-pulse"
        />
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[15px] font-semibold">{TEXTES_ATTENTE.titre(nom)}</p>
          <p role="status" aria-live="polite" className="m-0 text-sm text-encre-2">
            {ETAPES_ATTENTE[etape](nom)}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={TEXTES_ATTENTE.progression}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pourcent}
        className="h-2 overflow-hidden rounded-full bg-accent-fond"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${String(pourcent)}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-encre-3">
        <span>{TEXTES_ATTENTE.duree}</span>
        <span aria-hidden="true" className="tabular-nums">
          {TEXTES_ATTENTE.ecoule(Math.floor(ecoule / 1000))}
        </span>
      </div>
      <p className="m-0 border-l-2 border-accent pl-3 text-sm text-encre-2">
        <span className="font-semibold">{TEXTES_ATTENTE.astuce}</span> {astuce}
      </p>
      <div>
        <Bouton onClick={annuler}>{TEXTES_ATTENTE.annuler}</Bouton>
      </div>
    </Carte>
  );
}
