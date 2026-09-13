import type { Resultats } from '@loupe/moteur';
import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { Carte, GrosChiffre, Ligne, Pastille, Pourquoi, TitreCarte } from '@/composants/ui';
import { euros, eurosParMois, eurosSignes, nombre, pourcentage } from '@/formatage/nombres';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { EXPLICATIONS } from '@/textes/explications';
import { libelleFeu } from '@/textes/feux';
import { REGIMES, SCENARIOS } from '@/textes/regimes';
import { reponseCourte, texteVerdict } from '@/textes/verdict';

import { CartePrix } from './rapport/CartePrix';

function CarteCashflow({ r }: { r: Resultats }): JSX.Element {
  const c = r.cashflow;
  const ton = c.mensuel >= 0 ? 'bon' : c.mensuel >= -100 ? 'surveiller' : 'probleme';
  const reponse = c.mensuel >= 0 ? 'oui' : c.mensuel >= -100 ? 'presque' : 'non';
  return (
    <Carte>
      <TitreCarte action={<Pourquoi texte={EXPLICATIONS.cashflow} />}>
        Est-ce que ça s'autofinance ?
      </TitreCarte>
      <GrosChiffre ton={ton}>{reponseCourte(reponse)}</GrosChiffre>
      <div>
        <Ligne
          libelle="Loyer"
          valeur={eurosSignes(c.recettes.loyersBruts / 12)}
          tonValeur="font-bold text-bon"
        />
        <Ligne
          libelle="Crédit et assurance"
          valeur={eurosSignes(-r.financement.mensualiteTotale)}
        />
        <Ligne
          libelle="Charges, impôts locaux, entretien"
          valeur={eurosSignes(-c.chargesAnnuelles / 12)}
        />
        <Ligne
          libelle={`${nombre(r.projet.hypotheses.location.vacanceSemaines)} semaines vides par an`}
          valeur={eurosSignes(-c.recettes.vacance / 12)}
        />
        <Ligne
          libelle="Reste chaque mois"
          valeur={eurosSignes(c.mensuel)}
          fort
          tonValeur={c.mensuel < 0 ? 'text-probleme' : 'text-bon'}
        />
      </div>
      {c.pointMort !== null && (
        <p className="m-0 text-[15px] text-encre-2">
          À l'équilibre avec un loyer de <strong>{euros(c.pointMort)}</strong>.
        </p>
      )}
    </Carte>
  );
}

function Leviers({ r }: { r: Resultats }): JSX.Element | null {
  // Sur papier (ou en noir et blanc), la carte pleine d'encre devient une carte claire.
  const document = useModeDocument();
  const s = r.scenarios;
  if (s === null) return null;
  const negocier = s.scenarios.find((x) => x.code === 'negocier');
  const coloc = s.scenarios.find((x) => x.code === 'colocation');
  const autres = s.scenarios.filter((x) => x.code !== 'negocier' && x.code !== 'colocation');
  const separateur = document ? 'w-px bg-bordure' : 'w-px bg-white/25';
  return (
    <Carte
      className={`flex-row items-stretch gap-5 ${
        document ? 'border-accent-bordure bg-accent-fond' : 'border-accent bg-accent text-white'
      }`}
    >
      {negocier !== undefined && (
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide uppercase opacity-80">
            Levier 1 · Négocier
          </span>
          <span className="font-display text-[32px] font-bold">
            {euros(Number(negocier.parametres.prix ?? 0))}
          </span>
          <span className="text-sm leading-snug opacity-90">
            Cash-flow {eurosParMois(negocier.indicateurs.cashflowMensuel)}
            {negocier.indicateurs.tri !== null
              ? `, rendement de votre argent ${pourcentage(negocier.indicateurs.tri)}`
              : ''}
            .
          </span>
        </div>
      )}
      <div className={separateur} />
      {coloc !== undefined && (
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide uppercase opacity-80">
            Levier 2 · Colocation
          </span>
          <span className="font-display text-[32px] font-bold">
            {eurosParMois(coloc.indicateurs.cashflowMensuel)}
          </span>
          <span className="text-sm leading-snug opacity-90">
            {String(coloc.parametres.chambres ?? '')} chambres à{' '}
            {euros(Number(coloc.parametres.loyerParChambre ?? 0))}
            {coloc.indicateurs.tri !== null
              ? `, rendement ${pourcentage(coloc.indicateurs.tri)}`
              : ''}
            . Plus de gestion.
          </span>
        </div>
      )}
      <div className={separateur} />
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs font-bold tracking-wide uppercase opacity-80">Et si…</span>
        <div className="flex flex-col gap-1 text-sm">
          {autres.map((x) => (
            <div key={x.code} className="flex justify-between gap-3">
              <span className="opacity-85">{SCENARIOS[x.code]}</span>
              <span>{eurosParMois(x.indicateurs.cashflowMensuel)}</span>
            </div>
          ))}
        </div>
      </div>
    </Carte>
  );
}

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

export function Rapport(): JSX.Element {
  const { resultats: r } = useProjetCourant();
  const verdict = texteVerdict(r);
  return (
    <div className="flex flex-col gap-5 px-10 pt-8 pb-10">
      <div className="flex flex-col gap-3">
        <h1 className="m-0 max-w-[24ch] font-display text-[40px] leading-[1.1] font-bold tracking-tight text-balance">
          {verdict.titre}
        </h1>
        <p className="m-0 max-w-[64ch] text-[17px] leading-relaxed text-encre-2">
          {verdict.sousTitre}
        </p>
        <div className="flex flex-wrap gap-2.5 pt-1" aria-label="Cinq feux">
          {r.verdict.feux.map((f) => (
            <Pastille key={f.axe} ton={f.feu} feu={f.feu}>
              {libelleFeu(f)}
            </Pastille>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <CartePrix r={r} />
        <CarteCashflow r={r} />
      </div>
      <Leviers r={r} />
      <div className="grid grid-cols-2 gap-5">
        <CarteFiscalite r={r} />
        <CarteRevente r={r} />
      </div>
      <p className="m-0 text-xs text-encre-3">
        Règles fiscales {r.meta.versionRegles}. Outil d'aide à la décision, pas un conseil.
      </p>
    </div>
  );
}
