import type { Resultats } from '@loupe/moteur';
import type { JSX } from 'react';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, GrosChiffre, Ligne, Pastille, Pourquoi, TitreCarte } from '@/composants/ui';
import { euros, eurosSignes, pourcentage } from '@/formatage/nombres';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { EXPLICATIONS } from '@/textes/explications';
import { libelleFeu } from '@/textes/feux';
import { REGIMES } from '@/textes/regimes';
import { texteVerdict } from '@/textes/verdict';

import { CarteAutofinancement } from './rapport/CarteAutofinancement';
import { CartePrix } from './rapport/CartePrix';
import { CarteRendements } from './rapport/CarteRendements';
import { Leviers } from './rapport/Leviers';

function CarteFiscalite({ r }: { r: Resultats }): JSX.Element {
  const f = r.fiscalite;
  const retenu = f.regimes[f.retenu];
  const autres = Object.values(f.regimes)
    .filter((x) => x.regime !== f.retenu)
    .sort((a, b) => a.impotTotal - b.impotTotal);
  const annees = r.projet.hypotheses.revente.annees;
  return (
    <Carte>
      <TitreCarte
        action={<Pourquoi texte={EXPLICATIONS.fiscalite} libelle="Comparer les 4 régimes" />}
      >
        Combien d'impôts ?
      </TitreCarte>
      <GrosChiffre
        ton={retenu.impotTotal === 0 ? 'bon' : 'encre'}
        complement={`sur ${String(annees)} ans`}
      >
        {euros(retenu.impotTotal)}
      </GrosChiffre>
      <p className="m-0 text-[15px] text-encre-2">
        {REGIMES[f.retenu]}
        {retenu.premiereAnneeImposable === null
          ? ' : aucun impôt sur la période.'
          : ` : imposé à partir de l'année ${String(retenu.premiereAnneeImposable)}.`}
        {!retenu.eligible ? ' Plafond du régime dépassé.' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {autres.map((x) => (
          <Pastille key={x.regime} ton="neutre" compacte>
            {REGIMES[x.regime]} {euros(x.impotTotal)}
          </Pastille>
        ))}
      </div>
    </Carte>
  );
}

function CarteRevente({ r }: { r: Resultats }): JSX.Element {
  const e = r.rendement.enrichissement;
  const annees = r.projet.hypotheses.revente.annees;
  return (
    <Carte>
      <TitreCarte action={<Pourquoi texte={EXPLICATIONS.revente} libelle="Détail" />}>
        Qu'est-ce qu'il vous restera ?
      </TitreCarte>
      <GrosChiffre complement={`dans ${String(annees)} ans`}>
        {euros(r.revente.cashNetVendeur)}
      </GrosChiffre>
      <div>
        <Ligne
          libelle="Le locataire aura remboursé"
          valeur={eurosSignes(e.capitalRembourse)}
          tonValeur="font-bold text-bon"
        />
        <Ligne
          libelle="Vous aurez mis"
          valeur={eurosSignes(-(e.miseDeDepart - Math.min(0, e.cashflowsCumules)))}
        />
        <Ligne
          libelle={`Enrichissement${r.rendement.tri === null ? '' : ` · TRI ${pourcentage(r.rendement.tri)}`}`}
          valeur={eurosSignes(e.total)}
          fort
        />
      </div>
    </Carte>
  );
}

/** Deux cartes côte à côte sur tablette, ordinateur et papier ; empilées sur téléphone. */
const DEUX_CARTES = 'grid grid-cols-1 gap-5 md:grid-cols-2 print:grid-cols-2';

/**
 * Le Rapport : le verdict, les cinq feux, puis l'autofinancement en carte principale, le prix et
 * les rendements, les leviers, les impôts et la revente.
 */
export function Rapport(): JSX.Element {
  const { resultats: r } = useProjetCourant();
  const verdict = texteVerdict(r);
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <TitrePage taille="accroche" className="max-w-[24ch]">
          {verdict.titre}
        </TitrePage>
        <Chapo className="leading-relaxed">{verdict.sousTitre}</Chapo>
        <div className="flex flex-wrap gap-2.5 pt-1" aria-label="Cinq feux">
          {r.verdict.feux.map((f) => (
            <Pastille key={f.axe} ton={f.feu} feu={f.feu}>
              {libelleFeu(f)}
            </Pastille>
          ))}
        </div>
      </div>
      <CarteAutofinancement r={r} />
      <div className={DEUX_CARTES}>
        <CartePrix r={r} />
        <CarteRendements r={r} />
      </div>
      <Leviers r={r} />
      <div className={DEUX_CARTES}>
        <CarteFiscalite r={r} />
        <CarteRevente r={r} />
      </div>
      <p className="m-0 text-xs text-encre-3">
        Règles fiscales {r.meta.versionRegles}. Outil d'aide à la décision, pas un conseil.
      </p>
    </Page>
  );
}
