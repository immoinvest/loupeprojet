import {
  capitalRestantDu,
  finDuPret,
  mensualiteDuPret,
  periodeDe,
  type BienGere,
  type PretBien,
  type PretEnregistre,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, Ligne } from '@/composants/ui';
import { useArgent } from '@/gestion/argent/ArgentContext';
import { pretDepuisAnalyse } from '@/gestion/argent/pret-analyse';
import {
  lirePret,
  saisieDepuisPret,
  saisiePretVide,
  type ChampPretBien,
  type SaisiePret,
} from '@/gestion/argent/saisie-pret';
import type { ResultatArgent } from '@/gestion/argent/types';
import { moisEnLettres, montant } from '@/gestion/format';
import {
  conditionsDuPret,
  ERREURS_ARGENT,
  ERREURS_PRET,
  pretPropose,
  TEXTES_PRET as T,
} from '@/textes/gerer-argent';

import { ChampGerer } from '../ChampGerer';

const identifiant = (champ: ChampPretBien): string => `pret-${champ}`;

function FormulairePret({
  initiale,
  periode,
  occupe,
  onEnregistrer,
  onRetirer,
  onFermer,
}: {
  readonly initiale: PretBien | null;
  readonly periode: string;
  readonly occupe: boolean;
  readonly onEnregistrer: (pret: PretBien) => void;
  readonly onRetirer: (() => void) | undefined;
  readonly onFermer: () => void;
}): JSX.Element {
  const [saisie, setSaisie] = useState<SaisiePret>(() =>
    initiale === null ? saisiePretVide(periode) : saisieDepuisPret(initiale),
  );
  const [erreurs, setErreurs] = useState<readonly ChampPretBien[]>([]);
  const champ = (
    nom: ChampPretBien,
    libelle: string,
  ): {
    id: string;
    libelle: string;
    valeur: string;
    onChange: (v: string) => void;
    erreur: string | undefined;
  } => ({
    id: identifiant(nom),
    libelle,
    valeur: saisie[nom],
    onChange: (valeur) => {
      setSaisie((s) => ({ ...s, [nom]: valeur }));
    },
    erreur: erreurs.includes(nom) ? ERREURS_PRET[nom] : undefined,
  });

  return (
    <form
      noValidate
      aria-label={T.formulaire}
      className="flex flex-col gap-4 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const lu = lirePret(saisie);
        if (!lu.ok) {
          setErreurs(lu.erreurs);
          document.getElementById(identifiant(lu.erreurs[0] ?? 'capital'))?.focus();
          return;
        }
        setErreurs([]);
        onEnregistrer(lu.pret);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampGerer {...champ('capital', T.capital)} inputMode="decimal" unite="€" />
        <ChampGerer {...champ('taux', T.taux)} inputMode="decimal" unite="%" />
        <ChampGerer {...champ('duree', T.duree)} inputMode="decimal" unite="ans" />
        <ChampGerer
          {...champ('premiereEcheance', T.premiereEcheance)}
          inputMode="numeric"
          aide={T.premiereEcheanceAide}
        />
        <ChampGerer {...champ('assurance', T.assurance)} inputMode="decimal" unite="€" />
      </div>
      <p className="m-0 text-sm text-encre-3">{T.doubleCompte}</p>
      <div className="flex flex-wrap justify-end gap-2">
        {onRetirer !== undefined && (
          <button
            type="button"
            disabled={occupe}
            onClick={onRetirer}
            className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold text-probleme-texte survol-danger disabled:opacity-50"
          >
            {T.retirer}
          </button>
        )}
        <Bouton disabled={occupe} onClick={onFermer}>
          {T.fermer}
        </Bouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrer}
        </Bouton>
      </div>
    </form>
  );
}

/**
 * Le prêt du bien dans sa carte Argent. Enregistré : mensualité, capital restant dû, dernière
 * échéance. Sinon, pour un bien venu d'une analyse avec emprunt : « Enregistrer ce prêt » en un clic.
 */
export function CartePret({
  bien,
  pret,
  aujourdhui,
}: {
  readonly bien: BienGere;
  readonly pret: PretEnregistre | undefined;
  readonly aujourdhui: string;
}): JSX.Element {
  const { enregistrerPret, supprimerPret } = useArgent();
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const periode = periodeDe(aujourdhui);
  const propose = pret === undefined ? pretDepuisAnalyse(bien) : null;

  const executer = async (action: () => Promise<ResultatArgent<unknown>>): Promise<void> => {
    setOccupe(true);
    setEchec(null);
    const r = await action();
    setOccupe(false);
    if (r.ok) setOuvert(false);
    else setEchec(ERREURS_ARGENT[r.code]);
  };

  let contenu: JSX.Element;
  if (ouvert) {
    contenu = (
      <FormulairePret
        initiale={pret ?? propose}
        periode={periode}
        occupe={occupe}
        onEnregistrer={(p) => void executer(() => enregistrerPret(bien.id, p))}
        onRetirer={
          pret === undefined ? undefined : () => void executer(() => supprimerPret(bien.id))
        }
        onFermer={() => {
          setOuvert(false);
          setEchec(null);
        }}
      />
    );
  } else if (pret !== undefined) {
    contenu = (
      <>
        <p className="m-0 text-sm text-encre-2">
          {conditionsDuPret(pret.capital, pret.tauxAnnuel, pret.dureeMois)}
        </p>
        <div>
          <Ligne libelle={T.mensualite} valeur={montant(mensualiteDuPret(pret))} />
          <Ligne libelle={T.restantDu} valeur={montant(capitalRestantDu(pret, periode))} />
          <Ligne libelle={T.fin} valeur={moisEnLettres(finDuPret(pret))} />
        </div>
        <div>
          <Bouton
            onClick={() => {
              setOuvert(true);
            }}
          >
            {T.modifier}
          </Bouton>
        </div>
      </>
    );
  } else if (propose !== null) {
    contenu = (
      <>
        <p className="m-0 text-sm text-encre-2">
          {pretPropose(propose.capital, propose.tauxAnnuel, propose.dureeMois)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Bouton
            variante="primaire"
            disabled={occupe}
            onClick={() => void executer(() => enregistrerPret(bien.id, propose))}
          >
            {T.enregistrerPropose}
          </Bouton>
          <Bouton
            onClick={() => {
              setOuvert(true);
            }}
          >
            {T.ajuster}
          </Bouton>
        </div>
      </>
    );
  } else {
    contenu = (
      <>
        <p className="m-0 text-sm text-encre-2">{T.aucun}</p>
        <div>
          <Bouton
            onClick={() => {
              setOuvert(true);
            }}
          >
            {T.ajouter}
          </Bouton>
        </div>
      </>
    );
  }

  return (
    <section
      aria-label={T.titre}
      className="flex flex-col gap-3 border-t border-bordure-douce pt-4"
    >
      <h3 className="m-0 font-display text-lg font-semibold">{T.titre}</h3>
      {contenu}
      {echec !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {echec}
        </p>
      )}
    </section>
  );
}
