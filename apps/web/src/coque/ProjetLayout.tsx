import { calculerProjet, type Resultats } from '@loupe/moteur';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';

import { Bouton } from '@/composants/ui';
import { euros } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import { lienPartage } from '@/stockage/partage';
import { STATUTS, StatutProjetSchema, type ProjetEnregistre } from '@/stockage/projets';
import { AVERTISSEMENT_PARTAGE } from '@/textes/partage';
import { MODES } from '@/textes/regimes';

export interface ContexteProjet {
  readonly enregistre: ProjetEnregistre;
  readonly resultats: Resultats;
}

const Contexte = createContext<ContexteProjet | null>(null);

export function useProjetCourant(): ContexteProjet {
  const c = useContext(Contexte);
  if (c === null) throw new Error('useProjetCourant hors de ProjetLayout');
  return c;
}

/** Met un projet (enregistré ou partagé) et ses résultats à disposition des écrans. */
export function FournisseurProjet({
  enregistre,
  children,
}: {
  enregistre: ProjetEnregistre;
  children: ReactNode;
}): JSX.Element {
  const resultats = useMemo(() => calculerProjet(enregistre.projet), [enregistre]);
  return <Contexte.Provider value={{ enregistre, resultats }}>{children}</Contexte.Provider>;
}

export function ProjetIntrouvable(): JSX.Element {
  return (
    <div className="p-10">
      <h1 className="font-display text-3xl font-bold">Projet introuvable</h1>
      <p className="text-encre-2">
        Il a peut-être été supprimé. <Link to="/projets">Retour à mes projets</Link>.
      </p>
    </div>
  );
}

const ONGLETS = [
  { to: '', libelle: 'Rapport' },
  { to: 'adresse', libelle: 'Adresse' },
  { to: 'hypotheses', libelle: 'Hypothèses' },
  { to: 'fiscalite', libelle: 'Fiscalité' },
  { to: 'revente', libelle: 'Revente' },
  { to: 'visite', libelle: 'Visite' },
] as const;

const onglet = ({ isActive }: { isActive: boolean }): string =>
  `border-b-2 px-4 py-3 text-[15px] font-semibold ${
    isActive ? 'border-accent text-accent' : 'border-transparent text-encre-3 hover:text-encre'
  }`;

type EtatPartage = 'repos' | 'copie' | 'manuel';

const DUREE_CONFIRMATION_MS = 2_500;

/** Copie le lien de partage ; si le presse-papiers refuse, le lien s'affiche à copier à la main. */
function BoutonPartager({ enregistre }: { enregistre: ProjetEnregistre }): JSX.Element {
  const [etat, setEtat] = useState<EtatPartage>('repos');
  const lien = lienPartage(window.location.origin, enregistre);

  useEffect(() => {
    if (etat !== 'copie') return undefined;
    const minuteur = window.setTimeout(() => {
      setEtat('repos');
    }, DUREE_CONFIRMATION_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [etat]);

  const partager = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(lien);
      setEtat('copie');
    } catch {
      setEtat('manuel');
    }
  };

  return (
    <>
      {etat === 'manuel' && (
        <input
          readOnly
          aria-label="Lien de partage"
          value={lien}
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          className="min-h-[44px] w-64 rounded-full border border-bordure bg-surface px-3 text-xs"
        />
      )}
      <Bouton
        title={AVERTISSEMENT_PARTAGE}
        onClick={() => {
          void partager();
        }}
      >
        {etat === 'copie' ? 'Lien copié' : 'Partager'}
      </Bouton>
    </>
  );
}

function EnTete(): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { changerStatut } = useProjets();
  const naviguer = useNavigate();
  const { achat, location } = enregistre.projet.hypotheses;

  return (
    <header className="flex items-end gap-4 border-b border-bordure bg-surface px-10 pt-4 print:hidden">
      <div className="flex flex-col gap-1 pb-3.5">
        <span className="text-[13px] text-encre-3">
          <Link to="/projets" className="text-encre-3 no-underline hover:text-accent">
            Mes projets
          </Link>{' '}
          / {enregistre.nom}
        </span>
        <span className="font-display text-xl font-bold">
          {euros(achat.prix)} · {MODES[location.mode]}
        </span>
      </div>
      <div className="flex-1" />
      <nav aria-label="Volets du rapport" className="flex gap-1">
        {ONGLETS.map((o) => (
          <NavLink key={o.to} to={o.to} end={o.to === ''} className={onglet}>
            {o.libelle}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex gap-2 pb-3">
        <label className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-bordure bg-surface px-3.5 text-sm font-semibold text-encre-2">
          <span className="sr-only">Statut du projet</span>
          <select
            value={enregistre.statut}
            onChange={(e) => {
              changerStatut(enregistre.id, StatutProjetSchema.parse(e.target.value));
            }}
            className="bg-transparent font-semibold outline-none"
          >
            {StatutProjetSchema.options.map((s) => (
              <option key={s} value={s}>
                {STATUTS[s]}
              </option>
            ))}
          </select>
        </label>
        <Bouton
          onClick={() => {
            void naviguer(`/projets/${enregistre.id}/imprimer`, { state: { imprimer: true } });
          }}
        >
          PDF
        </Bouton>
        <BoutonPartager enregistre={enregistre} />
      </div>
    </header>
  );
}

export function ProjetLayout(): JSX.Element {
  const { id } = useParams();
  const { trouver } = useProjets();
  const enregistre = trouver(id);

  if (enregistre === undefined) return <ProjetIntrouvable />;

  return (
    <FournisseurProjet enregistre={enregistre}>
      <EnTete />
      <Outlet />
    </FournisseurProjet>
  );
}
