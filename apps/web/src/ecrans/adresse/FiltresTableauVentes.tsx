import type { JSX } from 'react';

import {
  RAYONS_CARTE_METRES,
  type CleTri,
  type FiltresVentes,
  type RayonCarte,
} from '@/enrichissement';
import { LIBELLES_GROUPES } from '@/textes/adresse';
import {
  LIBELLES_FILTRES,
  libelleFiltrePieces,
  phraseNombreVentes,
  PHRASES_VENTES,
  phraseTri,
} from '@/textes/ventes';

const PUCE =
  'min-h-[36px] rounded-full border px-3 text-sm font-semibold survol-fond pointer-coarse:min-h-11';
const ACTIVE = 'border-accent bg-accent-fond text-accent';
const INACTIVE = 'border-bordure bg-surface text-encre-2';

function Puce({
  active,
  libelle,
  onClick,
}: {
  active: boolean;
  libelle: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${PUCE} ${active ? ACTIVE : INACTIVE}`}
    >
      {libelle}
    </button>
  );
}

/**
 * Les filtres rapides du tableau des ventes, cumulables, et le rayon (aussi choisi en cliquant un cercle de la carte).
 * Ils s'appliquent aussi aux pastilles de la carte.
 */
export function FiltresTableauVentes({
  filtres,
  rayon,
  piecesBien,
  dpeConnus,
  avecDistances,
  nombreAffichees,
  cleTri,
  croissant,
  onFiltre,
  onRayon,
}: {
  filtres: FiltresVentes;
  rayon: RayonCarte | null;
  piecesBien: number;
  dpeConnus: boolean;
  avecDistances: boolean;
  nombreAffichees: number;
  cleTri: CleTri;
  croissant: boolean;
  onFiltre: (cle: keyof FiltresVentes) => void;
  onRayon: (rayon: RayonCarte) => void;
}): JSX.Element {
  const boutons: [keyof FiltresVentes, string][] = [
    ['memeImmeuble', LIBELLES_FILTRES.memeImmeuble],
    ['recentes', LIBELLES_FILTRES.recentes],
    ...(piecesBien > 0
      ? [['memesPieces', libelleFiltrePieces(piecesBien)] as [keyof FiltresVentes, string]]
      : []),
    ...(dpeConnus
      ? [['passoires', LIBELLES_FILTRES.passoires] as [keyof FiltresVentes, string]]
      : []),
  ];
  return (
    <div
      role="group"
      aria-label={PHRASES_VENTES.filtres}
      className="flex flex-wrap items-center gap-2 print:hidden"
    >
      {boutons.map(([cle, libelle]) => (
        <Puce
          key={cle}
          active={filtres[cle]}
          libelle={libelle}
          onClick={() => {
            onFiltre(cle);
          }}
        />
      ))}
      {avecDistances &&
        RAYONS_CARTE_METRES.map((r) => (
          <Puce
            key={r}
            active={rayon === r}
            libelle={LIBELLES_GROUPES[`rayon_${String(r)}` as `rayon_${RayonCarte}`]}
            onClick={() => {
              onRayon(r);
            }}
          />
        ))}
      <span className="text-sm text-encre-3" aria-live="polite">
        {phraseNombreVentes(nombreAffichees)} · {phraseTri(cleTri, croissant)}
      </span>
    </div>
  );
}
