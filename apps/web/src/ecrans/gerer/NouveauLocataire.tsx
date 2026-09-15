import { jourLocal, type EtatGestion } from '@loupe/gestion';
import type { JSX } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Carte } from '@/composants/ui';
import { useGestion } from '@/gestion/GestionContext';
import {
  CHEMIN_GERER,
  CHEMIN_MES_LOCATAIRES,
  etatLocationCreee,
  lienFicheLocataire,
  retourValide,
} from '@/gestion/parcours';
import { bienInitial, choixDesBiens, type ChoixDesBiens } from '@/gestion/saisie-nouveau-locataire';
import { bienEtChambre } from '@/textes/gerer-loyers';
import { TEXTES_PARCOURS as P } from '@/textes/gerer-parcours';

import { EcranAttente } from './EcranAttente';
import { FilAriane } from './FilAriane';
import { FormulaireLouer } from './nouveau/FormulaireLouer';
import { Portes } from './Portes';

function Contenu({
  donnees,
  choix,
  initial,
  retour,
  aujourdhui,
}: {
  readonly donnees: EtatGestion;
  readonly choix: ChoixDesBiens;
  readonly initial: string;
  /** La page d'origine validée, ou `null`. */
  readonly retour: string | null;
  readonly aujourdhui: string;
}): JSX.Element {
  const naviguer = useNavigate();
  return (
    <Page espacement="large" className="max-w-[760px]">
      <div className="flex flex-col gap-3">
        <FilAriane
          etapes={[
            { libelle: P.gerer, vers: CHEMIN_GERER },
            { libelle: P.mesLocataires, vers: CHEMIN_MES_LOCATAIRES },
            { libelle: P.nouveauLocataire },
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <TitrePage>{P.nouveauLocataire}</TitrePage>
          <Chapo>{P.nouveauLocataireChapo}</Chapo>
        </div>
      </div>
      <Carte>
        <FormulaireLouer
          donnees={donnees}
          choix={choix}
          bienInitial={initial}
          aujourdhui={aujourdhui}
          annuler={retour ?? CHEMIN_MES_LOCATAIRES}
          onLoue={({ locataire, location }, bienId) => {
            const bien = donnees.biens.find((b) => b.id === bienId);
            // Retour à la page d'origine ; sans origine, la fiche du nouveau locataire.
            void naviguer(retour ?? lienFicheLocataire(locataire.id), {
              state: etatLocationCreee({
                locataireId: locataire.id,
                locataire: `${locataire.prenom} ${locataire.nom}`,
                bien: bienEtChambre(bien?.nom ?? '', location.libelle),
              }),
            });
          }}
        />
      </Carte>
    </Page>
  );
}

/**
 * /gerer/locataires/nouveau?bien=…&retour=… : le seul formulaire pour louer un bien (ADR-G21),
 * ouvert depuis Mes biens, la fiche d'un bien, « À faire » et Mes locataires. Sans bien : les portes.
 */
export function NouveauLocataire(): JSX.Element {
  const { statut, donnees } = useGestion();
  const [recherche] = useSearchParams();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  const aujourdhui = jourLocal(new Date());
  const choix = choixDesBiens(donnees, aujourdhui);
  const initial = bienInitial(choix, recherche.get('bien'));
  if (initial === null) return <Portes />;
  return (
    <Contenu
      donnees={donnees}
      choix={choix}
      initial={initial}
      retour={retourValide(recherche.get('retour'))}
      aujourdhui={aujourdhui}
    />
  );
}
