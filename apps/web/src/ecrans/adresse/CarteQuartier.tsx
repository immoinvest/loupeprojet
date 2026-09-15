import { lazy, Suspense, useEffect, useMemo, useRef, useState, type JSX } from 'react';

import { Carte } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  donneesCarte,
  DUREE_MESSAGE_MS,
  messageGeste,
  modesCouleur,
  niveauPoint,
  pointsVisibles,
  type FondCarte,
  type Geste,
  type MessageGeste,
  type ModeCouleur,
  type ReponseAdresse,
} from '@/enrichissement';
import type { AdresseBien } from '@/stockage/projets';
import {
  legendeCouleurs,
  libelleAccessibleCarte,
  MESSAGES_GESTES,
  PHRASES_CARTE,
  phraseCarte,
} from '@/textes/carte';

import { BarreCarte } from './BarreCarte';
import type { LiaisonVentes } from './useLiaisonVentes';

/** Leaflet et son CSS ne sont chargés qu'à l'ouverture d'une carte. */
const CarteVentes = lazy(() => import('./CarteVentes'));

const HAUTEUR = 'h-[280px] sm:h-[380px]';

function ecranTactile(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Les ventes comparables du quartier sur une carte interactive, liée au tableau des ventes : réglages, légende,
 * gestes qui ne piègent pas la page (message sinon), plein écran fermé par Échap. Absente sans vente géolocalisée ;
 * jamais imprimée, les tableaux la remplacent sur papier.
 */
export function CarteQuartier({
  analyse,
  adresse,
  liaison,
}: {
  analyse: ReponseAdresse;
  adresse: AdresseBien;
  liaison: LiaisonVentes;
}): JSX.Element | null {
  const { enregistre } = useProjetCourant();
  const piecesBien = enregistre.projet.bien.pieces;
  const { etat, envoyer } = liaison;
  const [mode, setMode] = useState<ModeCouleur>('prix');
  const [fond, setFond] = useState<FondCarte>('plan');
  const [parcelles, setParcelles] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [recentrage, setRecentrage] = useState(0);
  const [message, setMessage] = useState<MessageGeste | null>(null);
  const [aujourdhui] = useState(() => new Date().toISOString().slice(0, 10));
  const [auDoigt] = useState(ecranTactile);
  const cadre = useRef<HTMLDivElement>(null);
  const derniereDemande = useRef(etat.demande);

  const donnees = useMemo(() => donneesCarte(analyse), [analyse]);
  const { filtres, rayon, selection } = etat;
  const points = useMemo(
    () =>
      donnees === null
        ? []
        : pointsVisibles(
            donnees.points,
            analyse.ventesProches,
            { ...etat, filtres, rayon },
            piecesBien,
          ).map((p) => ({ ...p, niveau: niveauPoint(p, mode, aujourdhui) })),
    [donnees, analyse, filtres, rayon, piecesBien, mode, aujourdhui],
  );

  useEffect(() => {
    if (message === null) return undefined;
    const minuterie = window.setTimeout(() => {
      setMessage(null);
    }, DUREE_MESSAGE_MS);
    return () => {
      window.clearTimeout(minuterie);
    };
  }, [message]);

  // « Sur la carte » depuis le tableau : la carte vient à l'écran (et se centre sur la vente, dans CarteVentes).
  useEffect(() => {
    if (etat.demande === derniereDemande.current) return;
    derniereDemande.current = etat.demande;
    const element = cadre.current;
    if (etat.afficher === 'carte' && typeof element?.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center' });
    }
  }, [etat.demande]);

  // Échap ferme d'abord la fiche de la vente (si le focus est dans la carte ou en plein écran), puis le plein écran.
  useEffect(() => {
    if (!pleinEcran && selection === null) return undefined;
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const dansLaCarte = pleinEcran || cadre.current?.contains(document.activeElement) === true;
      if (selection !== null && dansLaCarte) envoyer({ type: 'selectionner', cle: null });
      else if (pleinEcran) setPleinEcran(false);
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
    };
  }, [pleinEcran, selection, envoyer]);

  if (donnees === null) return null;

  /** Un geste que la carte ne prend pas : il reste à la page, avec un message qui dit comment faire. */
  const geste = (g: Geste, arreter: () => void): void => {
    const texte = messageGeste(g, pleinEcran);
    if (texte === null) return;
    if (g.type === 'molette') arreter();
    setMessage(texte);
  };

  return (
    <Carte className="print:hidden">
      <h2 className="m-0 font-display text-[22px] font-semibold">{PHRASES_CARTE.titre}</h2>
      <p className="m-0 text-[15px] text-encre-2">{phraseCarte(donnees.points.length)}</p>
      <div
        ref={cadre}
        className={
          pleinEcran
            ? 'fixed inset-0 z-[60] flex flex-col gap-3 overflow-y-auto bg-surface p-3 sm:p-4'
            : 'flex flex-col gap-3'
        }
      >
        <BarreCarte
          modes={modesCouleur(donnees.points)}
          mode={mode}
          onMode={setMode}
          fond={fond}
          onFond={setFond}
          parcelles={parcelles}
          onParcelles={setParcelles}
          pleinEcran={pleinEcran}
          onPleinEcran={() => {
            setPleinEcran(!pleinEcran);
          }}
          onRecentrer={() => {
            setRecentrage(recentrage + 1);
          }}
          legende={legendeCouleurs(mode, donnees.repere)}
        />
        <div
          role="region"
          aria-label={libelleAccessibleCarte(points.length)}
          className={`relative w-full ${pleinEcran ? 'min-h-[240px] flex-1' : HAUTEUR}`}
          onWheelCapture={(e) => {
            geste({ type: 'molette', ctrl: e.ctrlKey || e.metaKey }, () => {
              e.stopPropagation();
            });
          }}
          onTouchMoveCapture={(e) => {
            if (auDoigt) geste({ type: 'toucher', doigts: e.touches.length }, () => undefined);
          }}
        >
          <Suspense
            fallback={<p className="m-0 text-sm text-encre-3">{PHRASES_CARTE.chargement}</p>}
          >
            <CarteVentes
              lat={adresse.lat}
              lon={adresse.lon}
              points={points}
              fond={fond}
              parcelles={parcelles}
              pleinEcran={pleinEcran}
              auDoigt={auDoigt}
              recentrage={recentrage}
              selection={selection}
              centrage={etat.afficher === 'carte' ? etat.demande : 0}
              rayon={rayon}
              onSelection={(cle) => {
                envoyer({ type: 'selectionner', cle });
              }}
              onVoirTableau={(cle) => {
                setPleinEcran(false);
                envoyer({ type: 'voir', cle, dans: 'tableau' });
              }}
              onRayon={(r) => {
                envoyer({ type: 'rayon', rayon: r });
              }}
            />
          </Suspense>
          {message !== null && (
            <p role="status" className="carte-message">
              {MESSAGES_GESTES[message]}
            </p>
          )}
        </div>
      </div>
    </Carte>
  );
}
