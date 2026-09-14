import { calculerProjet } from '@loupe/moteur';
import { Trash2 } from 'lucide-react';
import { useMemo, useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router';

import { useCompte } from '@/compte/CompteContext';
import { Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille, Point } from '@/composants/ui';
import {
  dateCourte,
  euros,
  eurosParMois,
  pourcentage,
  pourcentageSigne,
} from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import { STATUTS, type ProjetEnregistre } from '@/stockage/projets';
import { TEXTES_MON_COMPTE } from '@/textes/mon-compte';
import { MODES } from '@/textes/regimes';

type Filtre = 'tous' | 'en_cours' | 'ecartes';

const FILTRES: readonly { code: Filtre; libelle: string }[] = [
  { code: 'tous', libelle: 'Tous' },
  { code: 'en_cours', libelle: 'En cours' },
  { code: 'ecartes', libelle: 'Écartés' },
];

/**
 * Carte d'un projet. Téléphone : le nom, les quatre métriques en deux colonnes, puis les feux et
 * « Supprimer ». À partir de 640 px, les métriques sur une rangée ; à partir de 1 280 px, tout sur
 * une rangée.
 */
const GRILLE_CARTE =
  'grid grid-cols-2 items-center gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_120px_44px] xl:gap-5';

function garder(p: ProjetEnregistre, filtre: Filtre): boolean {
  if (filtre === 'tous') return true;
  return filtre === 'ecartes' ? p.statut === 'ecarte' : p.statut !== 'ecarte';
}

function Metrique({
  libelle,
  valeur,
  ton = '',
}: {
  libelle: string;
  valeur: string;
  ton?: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-encre-3">{libelle}</span>
      <span className={`text-lg font-bold ${ton}`}>{valeur}</span>
    </div>
  );
}

function CarteProjet({
  p,
  onSupprimer,
}: {
  p: ProjetEnregistre;
  onSupprimer: () => void;
}): JSX.Element {
  const r = useMemo(() => calculerProjet(p.projet, { avecScenarios: false }), [p.projet]);
  const prix = r.verdict.feux.find((f) => f.axe === 'prix');
  const ecarte = p.statut === 'ecarte';
  return (
    <Carte className={`${GRILLE_CARTE} ${ecarte ? 'opacity-70' : ''}`}>
      <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-4 xl:col-span-1">
        <Link
          to={`/projets/${p.id}`}
          className="font-display text-lg font-bold text-encre no-underline hover:text-accent pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          {p.nom}
        </Link>
        <span className="text-[13px] text-encre-3">
          {euros(p.projet.hypotheses.achat.prix)} · {MODES[p.projet.hypotheses.location.mode]} ·{' '}
          {dateCourte(p.modifieLe)}
        </span>
        <span className="self-start">
          <Pastille
            ton={
              p.statut === 'visite' ? 'surveiller' : p.statut === 'scenario' ? 'accent' : 'neutre'
            }
            compacte
          >
            {STATUTS[p.statut]}
          </Pastille>
        </span>
      </div>
      <Metrique
        libelle="Prix vs marché"
        valeur={prix?.valeur === null || prix === undefined ? '—' : pourcentageSigne(prix.valeur)}
        ton={prix?.feu === 'bon' ? 'text-bon' : ''}
      />
      <Metrique
        libelle="Cash-flow"
        valeur={eurosParMois(r.cashflow.mensuel)}
        ton={r.cashflow.mensuel < 0 ? 'text-probleme' : 'text-bon'}
      />
      <Metrique libelle="Rendement net" valeur={pourcentage(r.rendement.rendements.net)} />
      <Metrique
        libelle="TRI 10 ans"
        valeur={r.rendement.tri === null ? '—' : pourcentage(r.rendement.tri)}
      />
      <div className="flex gap-1.5 sm:col-span-3 xl:col-span-1" aria-label="Cinq feux">
        {r.verdict.feux.map((f) => (
          <Point key={f.axe} feu={f.feu} taille={12} />
        ))}
      </div>
      <button
        type="button"
        onClick={onSupprimer}
        aria-label={`Supprimer ${p.nom}`}
        className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full text-encre-3 hover:bg-probleme-fond hover:text-probleme"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </Carte>
  );
}

export function MesProjets(): JSX.Element {
  const { projets, supprimer } = useProjets();
  const connecte = useCompte().etat === 'connecte';
  const naviguer = useNavigate();
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const visibles = projets.filter((p) => garder(p, filtre));

  return (
    <Page espacement="large">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <TitrePage>Mes projets</TitrePage>
          <span className="text-[15px] text-encre-3">
            {projets.length} {projets.length > 1 ? 'projets' : 'projet'} · sauvegardés sur cet
            appareil
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer">
            {FILTRES.map((f) => (
              <button
                key={f.code}
                type="button"
                aria-pressed={filtre === f.code}
                onClick={() => {
                  setFiltre(f.code);
                }}
                className={`min-h-[44px] rounded-full px-3.5 text-sm font-semibold ${
                  filtre === f.code
                    ? 'bg-accent-doux text-accent'
                    : 'border border-bordure text-encre-2'
                }`}
              >
                {f.libelle}
              </button>
            ))}
          </div>
          <Bouton
            onClick={() => {
              void naviguer('/comparer');
            }}
          >
            Comparer
          </Bouton>
          <Bouton
            variante="primaire"
            onClick={() => {
              void naviguer('/projets/nouveau');
            }}
          >
            Nouveau projet
          </Bouton>
        </div>
      </div>

      {visibles.length === 0 ? (
        <Carte>
          <p className="m-0 text-encre-2">Aucun projet dans cette liste.</p>
        </Carte>
      ) : (
        <div className="flex flex-col gap-3">
          {visibles.map((p) => (
            <CarteProjet
              key={p.id}
              p={p}
              onSupprimer={() => {
                supprimer(p.id);
              }}
            />
          ))}
        </div>
      )}

      <Carte className="border-accent-bordure bg-accent-fond sm:flex-row sm:items-center sm:gap-5">
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-display text-[17px] font-bold">
            {connecte ? TEXTES_MON_COMPTE.carteTitreConnecte : TEXTES_MON_COMPTE.carteTitre}
          </span>
          <span className="text-sm text-encre-2">
            {connecte ? TEXTES_MON_COMPTE.carteTexteConnecte : TEXTES_MON_COMPTE.carteTexte}
          </span>
        </div>
        {!connecte && (
          <Bouton
            variante="primaire"
            onClick={() => {
              void naviguer('/connexion');
            }}
          >
            {TEXTES_MON_COMPTE.creerCompte}
          </Bouton>
        )}
      </Carte>

      <p className="m-0 text-xs text-encre-3">
        Les cinq points reprennent les feux du rapport : prix · rendement · cash-flow · crédit ÷
        loyer · risques.
      </p>
    </Page>
  );
}
