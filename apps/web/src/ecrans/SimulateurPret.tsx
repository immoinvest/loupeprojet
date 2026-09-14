import { VERSION_REGLES_COURANTE, obtenirRegles, type Regles } from '@loupe/moteur';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille, TitreCarte } from '@/composants/ui';
import { versTexte, type Descripteur } from '@/hypotheses';
import {
  CHAMPS_OFFRE,
  CHAMPS_PROJET,
  CHEMIN_IMPRESSION,
  ajouterOffreB,
  appliquerTexte,
  calculer,
  ecrireSimulation,
  etatInitial,
  fraisNotaireManuels,
  fragmentSimulation,
  lienSimulateur,
  reestimerFraisNotaire,
  retirerOffreB,
  type Colonne,
  type EtatInitial,
  type Saisie,
  type TextesOffre,
} from '@/simulateur';
import {
  BOUTONS_SIMULATEUR as B,
  PHRASES_SIMULATEUR as PHRASES,
  TITRES_SIMULATEUR as T,
} from '@/textes/simulateur';

import { Comparaison } from './simulateur/Comparaison';
import { Explications } from './simulateur/Explications';
import { FormulaireColonne } from './simulateur/FormulaireColonne';
import { ResultatOffre } from './simulateur/ResultatOffre';
import { TableauxAmortissement, type OngletOffre } from './simulateur/TableauxAmortissement';
import type { BadgeProvenance } from './hypotheses/ChampHypothese';

/** La simulation valide est enregistrée et mise dans l'adresse un peu après la dernière frappe. */
const DELAI_ENREGISTREMENT_MS = 300;
const DUREE_CONFIRMATION_MS = 2_500;

const BADGES = {
  estime: { ton: 'surveiller', libelle: PHRASES.fraisEstimes },
  aToi: { ton: 'accent', libelle: PHRASES.fraisAToi },
  tauxDuMois: { ton: 'bon', libelle: PHRASES.tauxDuMois },
} as const satisfies Record<string, BadgeProvenance>;

function badgeProjet(d: Descripteur, saisie: Saisie, regles: Regles): BadgeProvenance | null {
  if (d.chemin === 'fraisNotaire') {
    return fraisNotaireManuels(saisie.projet, regles) ? BADGES.aToi : BADGES.estime;
  }
  return d.aToi === true ? BADGES.aToi : null;
}

function badgeOffre(d: Descripteur, offre: TextesOffre, regles: Regles): BadgeProvenance | null {
  if (d.chemin === 'tauxNominal') {
    const duMois = versTexte(regles.credit.tauxMoyens['20'], 'pourcent');
    return offre.tauxNominal.trim() === duMois ? BADGES.tauxDuMois : BADGES.aToi;
  }
  return d.aToi === true ? BADGES.aToi : null;
}

type EtatLien = 'repos' | 'copie' | 'manuel';

export function SimulateurPret(): JSX.Element {
  const regles = obtenirRegles(VERSION_REGLES_COURANTE);
  const { hash, pathname } = useLocation();
  const naviguer = useNavigate();
  const [etat, setEtat] = useState<EtatInitial>(() =>
    etatInitial(hash, window.localStorage, regles),
  );
  const [lien, setLien] = useState<EtatLien>('repos');
  const { saisie, lienIllisible, aEnregistrer } = etat;
  const calcul = useMemo(() => calculer(saisie, regles), [saisie, regles]);
  const simulation = calcul.conversion.simulation;

  useEffect(() => {
    if (!aEnregistrer || simulation === null) return undefined;
    const minuteur = window.setTimeout(() => {
      ecrireSimulation(window.localStorage, simulation);
      // L'adresse suit la simulation sans passer par le routeur : le focus reste dans le champ.
      window.history.replaceState(
        window.history.state as unknown,
        '',
        `${pathname}${fragmentSimulation(simulation)}`,
      );
    }, DELAI_ENREGISTREMENT_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [aEnregistrer, simulation, pathname]);

  useEffect(() => {
    if (lien !== 'copie') return undefined;
    const minuteur = window.setTimeout(() => {
      setLien('repos');
    }, DUREE_CONFIRMATION_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [lien]);

  const modifier = (transformer: (s: Saisie) => Saisie): void => {
    setEtat((prev) => ({
      saisie: transformer(prev.saisie),
      lienIllisible: false,
      aEnregistrer: true,
    }));
  };
  const changer = (colonne: Colonne) => (cle: string, texte: string) => {
    modifier((s) => appliquerTexte(s, regles, colonne, cle, texte));
  };

  const copierLien = async (): Promise<void> => {
    if (simulation === null) return;
    try {
      await navigator.clipboard.writeText(lienSimulateur(window.location.origin, simulation));
      setLien('copie');
    } catch {
      setLien('manuel');
    }
  };

  const imprimer = (): void => {
    if (simulation === null) return;
    void naviguer(`${CHEMIN_IMPRESSION}${fragmentSimulation(simulation)}`, {
      state: { imprimer: true },
    });
  };

  const { offres, erreurs } = calcul.conversion;
  const offreB = saisie.offres[1];
  const onglets: OngletOffre[] = [];
  calcul.resultats.forEach((r, i) => {
    const offre = offres[i];
    if (r !== null && offre !== undefined && offre !== null) {
      onglets.push({ nom: calcul.noms[i === 0 ? 0 : 1], offre, resultat: r });
    }
  });
  const [a, b] = offres;

  return (
    <Page>
      <div className="flex flex-col gap-2">
        <TitrePage>{T.page}</TitrePage>
        <Chapo>{T.chapo}</Chapo>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Bouton variante="primaire" onClick={imprimer} disabled={simulation === null}>
          {B.imprimer}
        </Bouton>
        <Bouton
          onClick={() => {
            void copierLien();
          }}
          disabled={simulation === null}
        >
          {lien === 'copie' ? B.lienCopie : B.copierLien}
        </Bouton>
        {lien === 'manuel' && simulation !== null && (
          <input
            readOnly
            aria-label="Lien de la simulation"
            value={lienSimulateur(window.location.origin, simulation)}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            className="min-h-[44px] w-full min-w-0 rounded-full border border-bordure bg-surface px-3 text-xs sm:w-96 pointer-coarse:text-base"
          />
        )}
        {lienIllisible && (
          <Pastille ton="surveiller" feu="surveiller" compacte>
            {PHRASES.lienIllisible}
          </Pastille>
        )}
        <span role="status" className="sr-only">
          {lien === 'copie' ? B.lienCopie : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FormulaireColonne
          titre={T.projet}
          colonne="projet"
          champs={CHAMPS_PROJET}
          textes={saisie.projet}
          erreurs={erreurs}
          badge={(d) => badgeProjet(d, saisie, regles)}
          onChange={changer('projet')}
          pied={
            fraisNotaireManuels(saisie.projet, regles) && (
              <div>
                <Bouton
                  onClick={() => {
                    modifier((s) => reestimerFraisNotaire(s, regles));
                  }}
                >
                  {B.reestimer}
                </Bouton>
              </div>
            )
          }
        />
        <FormulaireColonne
          titre={calcul.noms[0]}
          colonne="a"
          champs={CHAMPS_OFFRE}
          textes={saisie.offres[0]}
          erreurs={erreurs}
          badge={(d) => badgeOffre(d, saisie.offres[0], regles)}
          onChange={changer('a')}
        />
        {offreB === null ? (
          <Carte className="justify-center">
            <TitreCarte>{calcul.noms[1]}</TitreCarte>
            <p className="m-0 text-[15px] text-encre-2">{PHRASES.sansComparaison}</p>
            <div>
              <Bouton
                variante="primaire"
                onClick={() => {
                  modifier(ajouterOffreB);
                }}
              >
                {B.ajouterB}
              </Bouton>
            </div>
          </Carte>
        ) : (
          <FormulaireColonne
            titre={calcul.noms[1]}
            colonne="b"
            champs={CHAMPS_OFFRE}
            textes={offreB}
            erreurs={erreurs}
            badge={(d) => badgeOffre(d, offreB, regles)}
            onChange={changer('b')}
            action={
              <Bouton
                onClick={() => {
                  modifier(retirerOffreB);
                }}
              >
                {B.retirerB}
              </Bouton>
            }
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ResultatOffre
          nom={calcul.noms[0]}
          offre={a}
          resultat={calcul.resultats[0]}
          regles={regles}
        />
        {offreB !== null && (
          <ResultatOffre
            nom={calcul.noms[1]}
            offre={b}
            resultat={calcul.resultats[1]}
            regles={regles}
          />
        )}
      </div>
      <Explications />

      {calcul.comparaison !== null && a !== null && b !== null && (
        <Comparaison comparaison={calcul.comparaison} noms={calcul.noms} offres={[a, b]} />
      )}
      {onglets.length > 0 && <TableauxAmortissement onglets={onglets} />}
    </Page>
  );
}
