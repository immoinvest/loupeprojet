import type { OffrePret, Regles, ResultatPret } from '@loupe/moteur';
import type { JSX } from 'react';

import { Carte, GrosChiffre, Ligne, Pastille, TitreCarte } from '@/composants/ui';
import { euros, eurosCentimes, pourcentage } from '@/formatage/nombres';
import { LIBELLES_PHASES } from '@/simulateur';
import { LIBELLES_RESULTATS as L, PHRASES_SIMULATEUR as PHRASES } from '@/textes/simulateur';

const taux = (valeur: number | null): string => (valeur === null ? '—' : pourcentage(valeur, 2));

function Pastilles({ r, regles }: { r: ResultatPret; regles: Regles }): JSX.Element | null {
  const endettementEleve = r.endettement !== null && r.endettement > regles.credit.hcsf.seuilEffort;
  if (!r.tauxUsureDepasse && !endettementEleve) return null;
  return (
    <span className="flex flex-wrap gap-2">
      {r.tauxUsureDepasse && (
        <Pastille ton="probleme" feu="probleme" compacte>
          {PHRASES.usure(r.tauxUsure, regles.dateReference)}
        </Pastille>
      )}
      {endettementEleve && (
        <Pastille ton="surveiller" feu="surveiller" compacte>
          {PHRASES.endettementEleve(regles.credit.hcsf.seuilEffort)}
        </Pastille>
      )}
    </span>
  );
}

function Echeancier({ r }: { r: ResultatPret }): JSX.Element | null {
  if (r.echeancier.length < 2) return null;
  return (
    <div className="flex flex-col gap-1 rounded-encart bg-accent-fond p-3 text-sm">
      <span className="font-semibold">{L.echeancier}</span>
      {r.echeancier.map((e) => (
        <span key={e.deMois} className="flex justify-between gap-3">
          <span>
            Mois {e.deMois} à {e.aMois} · {LIBELLES_PHASES[e.phase].toLowerCase()}
          </span>
          <span className="whitespace-nowrap">{eurosCentimes(e.mensualiteTotale)}/mois</span>
        </span>
      ))}
    </div>
  );
}

function Detail({
  offre,
  r,
  regles,
}: {
  offre: OffrePret;
  r: ResultatPret;
  regles: Regles;
}): JSX.Element {
  const frais = offre.fraisBancairesFinances ? 'financés par le prêt' : 'payés à la signature';
  return (
    <>
      <GrosChiffre complement="par mois, assurance comprise">
        {eurosCentimes(r.mensualiteTotale)}
      </GrosChiffre>
      <Echeancier r={r} />
      <div>
        <Ligne libelle={L.montantEmprunte} valeur={euros(r.montantEmprunte)} />
        <Ligne
          libelle={L.mensualiteHorsAssurance}
          valeur={eurosCentimes(r.mensualiteHorsAssurance)}
        />
        <Ligne libelle={L.assuranceMensuelle} valeur={eurosCentimes(r.assuranceMensuelle)} />
        <Ligne libelle={L.taegHorsAssurance} valeur={taux(r.taegHorsAssurance)} />
        <Ligne
          libelle={L.taegAvecAssurance}
          valeur={taux(r.taegAvecAssurance)}
          tonValeur={r.tauxUsureDepasse ? 'text-probleme' : ''}
        />
        <Ligne libelle={L.totalInterets} valeur={euros(r.totalInterets)} />
        <Ligne libelle={L.totalAssurance} valeur={euros(r.totalAssurance)} />
        <Ligne libelle={`${L.fraisBancaires} (${frais})`} valeur={euros(r.fraisBancaires)} />
        <Ligne libelle={L.coutTotalCredit} valeur={euros(r.coutTotalCredit)} fort />
        {r.endettement !== null && (
          <Ligne
            libelle={L.endettement}
            valeur={pourcentage(r.endettement, 1)}
            tonValeur={r.endettement > regles.credit.hcsf.seuilEffort ? 'text-surveiller' : ''}
          />
        )}
      </div>
    </>
  );
}

/** La carte de résultats d'une offre : mensualité en grand, puis chaque chiffre, puis l'échéancier. */
export function ResultatOffre({
  nom,
  offre,
  resultat,
  regles,
}: {
  nom: string;
  offre: OffrePret | null;
  resultat: ResultatPret | null;
  regles: Regles;
}): JSX.Element {
  const calculee = offre !== null && resultat !== null;
  return (
    <Carte>
      <TitreCarte action={calculee ? <Pastilles r={resultat} regles={regles} /> : undefined}>
        {nom}
      </TitreCarte>
      {!calculee ? (
        <p className="m-0 text-[15px] text-probleme">{PHRASES.corrigez}</p>
      ) : !resultat.aEmprunter ? (
        <>
          <p className="m-0 text-[15px] text-encre-2">{PHRASES.rienAEmprunter}</p>
          <div>
            <Ligne libelle={L.fraisBancaires} valeur={euros(resultat.fraisBancaires)} />
            <Ligne libelle={L.coutTotalCredit} valeur={euros(resultat.coutTotalCredit)} fort />
            {resultat.endettement !== null && (
              <Ligne libelle={L.endettement} valeur={pourcentage(resultat.endettement, 1)} />
            )}
          </div>
        </>
      ) : (
        <Detail offre={offre} r={resultat} regles={regles} />
      )}
    </Carte>
  );
}
