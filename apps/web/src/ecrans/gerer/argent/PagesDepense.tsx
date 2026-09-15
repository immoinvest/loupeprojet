import { jourLocal } from '@loupe/gestion';
import { useState, type JSX } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte } from '@/composants/ui';
import { useArgent } from '@/gestion/argent/ArgentContext';
import {
  SANS_BIEN,
  saisieDepenseInitiale,
  saisieDepuisDepense,
} from '@/gestion/argent/saisie-depense';
import { useGestion } from '@/gestion/GestionContext';
import { CHEMIN_ARGENT, CHEMIN_GERER, retourValide } from '@/gestion/parcours';
import { ERREURS_ARGENT, TEXTES_ARGENT as A, TEXTES_DEPENSE as T } from '@/textes/gerer-argent';
import { TEXTES_PARCOURS as P } from '@/textes/gerer-parcours';

import { EcranAttente } from '../EcranAttente';
import { FilAriane } from '../FilAriane';
import { AttenteArgent } from './AttenteArgent';
import { FormulaireDepense } from './FormulaireDepense';

function Entete({ titre }: { readonly titre: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <FilAriane
        etapes={[
          { libelle: P.gerer, vers: CHEMIN_GERER },
          { libelle: A.titre, vers: CHEMIN_ARGENT },
          { libelle: titre },
        ]}
      />
      <TitrePage>{titre}</TitrePage>
    </div>
  );
}

/** /gerer/depenses/nouvelle?bien=…&retour=… : le bien d'où l'on vient est déjà choisi. */
export function NouvelleDepense(): JSX.Element {
  const { statut, donnees } = useGestion();
  const argent = useArgent();
  const [recherche] = useSearchParams();
  const naviguer = useNavigate();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  if (argent.donnees === null) return <AttenteArgent titre={T.nouvelle} />;
  const retour = retourValide(recherche.get('retour')) ?? CHEMIN_ARGENT;
  const bienId = donnees.biens.find((b) => b.id === recherche.get('bien'))?.id ?? SANS_BIEN;
  return (
    <Page className="max-w-[760px]">
      <Entete titre={T.nouvelle} />
      <Carte>
        <FormulaireDepense
          titre={T.nouvelle}
          biens={donnees.biens}
          initiale={saisieDepenseInitiale(jourLocal(new Date()), bienId)}
          annuler={retour}
          enregistrer={argent.ajouterDepense}
          onEnregistre={() => {
            void naviguer(retour);
          }}
        />
      </Carte>
    </Page>
  );
}

/** « Supprimer cette dépense » (clic 1) puis « Supprimer définitivement » (clic 2). */
function SupprimerDepense({
  id,
  retour,
}: {
  readonly id: string;
  readonly retour: string;
}): JSX.Element {
  const { supprimerDepense } = useArgent();
  const naviguer = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setOuvert(true);
          }}
          className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold text-probleme-texte survol-danger"
        >
          {T.supprimer}
        </button>
      </div>
    );
  }

  const supprimer = async (): Promise<void> => {
    setOccupe(true);
    const r = await supprimerDepense(id);
    if (r.ok) {
      void naviguer(retour);
      return;
    }
    setOccupe(false);
    setErreur(ERREURS_ARGENT[r.code]);
  };

  return (
    <section
      aria-label={T.confirmerTitre}
      className="flex flex-col gap-3 rounded-encart border border-probleme bg-probleme-fond p-4"
    >
      <h2 className="m-0 font-display text-lg font-bold text-probleme-texte">{T.confirmerTitre}</h2>
      <p className="m-0 text-sm text-encre-2">{T.confirmerTexte}</p>
      <div className="flex flex-wrap gap-2">
        <Bouton
          disabled={occupe}
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
        >
          {T.annuler}
        </Bouton>
        <button
          type="button"
          disabled={occupe}
          onClick={() => {
            void supprimer();
          }}
          className="inline-flex min-h-[44px] items-center rounded-full bg-probleme px-4 text-sm font-semibold text-white survol-danger-plein disabled:opacity-50"
        >
          {T.supprimerDefinitivement}
        </button>
      </div>
      {erreur !== null && (
        <p role="alert" className="m-0 text-sm font-semibold text-probleme-texte">
          {erreur}
        </p>
      )}
    </section>
  );
}

/** /gerer/depenses/:id?retour=… : modifier une dépense, ou la supprimer. */
export function ModifierDepense(): JSX.Element {
  const { id = '' } = useParams();
  const { statut, donnees } = useGestion();
  const argent = useArgent();
  const [recherche] = useSearchParams();
  const naviguer = useNavigate();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  if (argent.donnees === null) return <AttenteArgent titre={T.modifier} />;
  const retour = retourValide(recherche.get('retour')) ?? CHEMIN_ARGENT;
  const depense = argent.donnees.depenses.find((d) => d.id === id);
  if (depense === undefined) {
    return (
      <Page className="max-w-[760px]">
        <TitrePage>{T.introuvable}</TitrePage>
        <Chapo>
          <Link to={CHEMIN_ARGENT}>{T.voirArgent}</Link>
        </Chapo>
      </Page>
    );
  }
  return (
    <Page className="max-w-[760px]">
      <Entete titre={T.modifier} />
      <Carte>
        <FormulaireDepense
          titre={T.modifier}
          biens={donnees.biens}
          initiale={saisieDepuisDepense(depense)}
          annuler={retour}
          enregistrer={(modifiee) => argent.modifierDepense(depense.id, modifiee)}
          onEnregistre={() => {
            void naviguer(retour);
          }}
        />
      </Carte>
      <SupprimerDepense id={depense.id} retour={retour} />
    </Page>
  );
}
