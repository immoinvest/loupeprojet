import {
  BailleurBienSchema,
  TYPES_BAILLEUR,
  type BailleurBien,
  type BienGere,
  type IdentiteBailleur,
  type TypeBailleur,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, Carte, TitreCarte } from '@/composants/ui';
import { useEnvois } from '@/gestion/envois/EnvoisContext';
import { bailleurDuBien } from '@/gestion/envois/logique';
import { ERREURS_ENVOIS, TEXTES_ENVOIS as T, TYPES_BAILLEUR_TEXTES } from '@/textes/gerer-envois';

import { ChampGerer } from '../ChampGerer';

type Champ = 'nom' | 'adresse';

interface Saisie {
  readonly type: TypeBailleur;
  readonly nom: string;
  readonly adresse: string;
}

function identifiant(bienId: string, champ: Champ): string {
  return `bailleur-bien-${bienId}-${champ}`;
}

/**
 * « Bailleur de ce bien » sur la fiche d'un bien (revue B de l'épic) : une SCI ou un autre bailleur,
 * repris sur les quittances suivantes de ce bien. « Indiquer un autre bailleur » (clic 1), « Enregistrer » (clic 2).
 */
export function BailleurDuBien({
  bien,
  bailleurCompte,
}: {
  readonly bien: BienGere;
  readonly bailleurCompte: IdentiteBailleur | null;
}): JSX.Element | null {
  const envois = useEnvois();
  const propre = bailleurDuBien(envois.donnees, bien.id);
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [erreurs, setErreurs] = useState<readonly Champ[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  if (envois.statut !== 'pret') return null;

  const ouvrir = (depart: BailleurBien | undefined): void => {
    setSaisie({
      type: depart?.type ?? 'sci',
      nom: depart?.nom ?? '',
      adresse: depart?.adresse ?? '',
    });
    setErreurs([]);
    setEchec(null);
  };

  const enregistrer = async (bailleur: BailleurBien | null): Promise<void> => {
    setOccupe(true);
    const r = await envois.enregistrerBailleurBien(bien.id, bailleur);
    setOccupe(false);
    if (r.ok) setSaisie(null);
    else setEchec(ERREURS_ENVOIS[r.code]);
  };

  const soumettre = async (s: Saisie): Promise<void> => {
    const lu = BailleurBienSchema.safeParse(s);
    if (!lu.success) {
      const chemins = new Set(lu.error.issues.map((i) => String(i.path[0])));
      const invalides = (['nom', 'adresse'] as const).filter((c) => chemins.has(c));
      setErreurs(invalides);
      document.getElementById(identifiant(bien.id, invalides[0] ?? 'nom'))?.focus();
      return;
    }
    setErreurs([]);
    await enregistrer(lu.data);
  };

  const actuel = propre ?? bailleurCompte;

  return (
    <Carte>
      <TitreCarte>{T.bailleurTitre}</TitreCarte>
      {actuel !== null ? (
        <div className="flex flex-col gap-0.5 text-[15px]">
          <p className="m-0 font-semibold text-encre">{actuel.nom}</p>
          <p className="m-0 text-encre-2">{actuel.adresse}</p>
          {propre === undefined && <p className="m-0 text-sm text-encre-3">{T.bailleurDuCompte}</p>}
        </div>
      ) : (
        <p className="m-0 text-[15px] text-encre-2">{T.bailleurAucun}</p>
      )}

      {saisie === null ? (
        <div className="flex flex-wrap gap-2">
          <Bouton
            onClick={() => {
              ouvrir(propre);
            }}
          >
            {propre === undefined ? T.autreBailleur : T.modifierBailleur}
          </Bouton>
          {propre !== undefined && (
            <Bouton disabled={occupe} onClick={() => void enregistrer(null)}>
              {T.revenirIdentite}
            </Bouton>
          )}
        </div>
      ) : (
        <form
          noValidate
          aria-label={T.formulaireBailleur}
          className="flex flex-col gap-4 rounded-encart bg-accent-fond p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void soumettre(saisie);
          }}
        >
          <p className="m-0 text-sm text-encre-2">{T.bailleurPhrase}</p>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 text-sm font-semibold text-encre-2">{T.typeBailleur}</legend>
            <div className="inline-flex self-start rounded-full bg-bordure-douce p-1">
              {TYPES_BAILLEUR.map((type) => (
                <label
                  key={type}
                  className={`flex min-h-11 cursor-pointer items-center rounded-full px-5 text-sm font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                    saisie.type === type
                      ? 'bg-surface text-encre shadow-carte'
                      : 'text-encre-3 survol-discret'
                  }`}
                >
                  <input
                    type="radio"
                    name={`bailleur-bien-${bien.id}-type`}
                    value={type}
                    checked={saisie.type === type}
                    onChange={() => {
                      setSaisie({ ...saisie, type });
                    }}
                    className="sr-only"
                  />
                  {TYPES_BAILLEUR_TEXTES[type]}
                </label>
              ))}
            </div>
          </fieldset>
          <ChampGerer
            id={identifiant(bien.id, 'nom')}
            libelle={T.nomBailleur}
            valeur={saisie.nom}
            onChange={(nom) => {
              setSaisie({ ...saisie, nom });
            }}
            erreur={erreurs.includes('nom') ? T.nomInvalide : undefined}
            autoComplete="organization"
          />
          <ChampGerer
            id={identifiant(bien.id, 'adresse')}
            libelle={T.adresseBailleur}
            valeur={saisie.adresse}
            onChange={(adresse) => {
              setSaisie({ ...saisie, adresse });
            }}
            erreur={erreurs.includes('adresse') ? T.adresseInvalide : undefined}
            autoComplete="street-address"
          />
          {echec !== null && (
            <p
              role="alert"
              className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
            >
              {echec}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Bouton
              disabled={occupe}
              onClick={() => {
                setSaisie(null);
              }}
            >
              {T.annuler}
            </Bouton>
            <Bouton variante="primaire" type="submit" disabled={occupe}>
              {T.enregistrer}
            </Bouton>
          </div>
        </form>
      )}
    </Carte>
  );
}
