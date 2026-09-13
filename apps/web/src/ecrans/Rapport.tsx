import type { Resultats } from '@loupe/moteur';
import type { JSX } from 'react';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, GrosChiffre, Ligne, Pastille, Pourquoi, TitreCarte } from '@/composants/ui';
import { euros, eurosSignes, nombre, pourcentage } from '@/formatage/nombres';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { EXPLICATIONS } from '@/textes/explications';
import { libelleFeu } from '@/textes/feux';
import { REGIMES } from '@/textes/regimes';
import { reponseCourte, texteVerdict } from '@/textes/verdict';

import { JaugePrix } from './rapport/JaugePrix';
import { Leviers } from './rapport/Leviers';

function CartePrix({ r }: { r: Resultats }): JSX.Element {
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
    </Page>
  );
}
