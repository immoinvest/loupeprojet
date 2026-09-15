import { useState, type JSX } from 'react';
import { Link } from 'react-router';

import { Bouton, Carte, TitreCarte } from '@/composants/ui';
import { A_FAIRE_VISIBLES, cleAction, type ActionAFaire } from '@/gestion/a-faire';
import {
  CHEMIN_GERER,
  lienConformite,
  lienFicheBien,
  lienFicheLocataire,
  lienFinBail,
  lienNouveauLocataire,
  lienRevision,
} from '@/gestion/parcours';
import { alerteAFaire, revisionAFaire } from '@/textes/gerer-bail';
import { depotAFaire, echeanceEnLettres, soldeEnLettres } from '@/textes/gerer-fin-bail';
import {
  ajouterEmailDe,
  louerLeBien,
  loyerEnRetardDe,
  TEXTES_A_FAIRE as T,
  voirLesAutres,
} from '@/textes/gerer-a-faire';
import { enregistrerLePretDe } from '@/textes/gerer-argent';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';
import { bienEtChambre } from '@/textes/gerer-loyers';

interface Ligne {
  readonly vers: string;
  readonly libelle: string;
  readonly precision?: string;
  readonly point: string;
}

function ligneDe(action: ActionAFaire): Ligne {
  switch (action.type) {
    case 'retard': {
      const { ligne } = action;
      return {
        // Joindre le locataire ; sans locataire retrouvé, le bien.
        vers:
          ligne.locataire === undefined
            ? lienFicheBien(ligne.location.bienId)
            : lienFicheLocataire(ligne.locataire.id),
        libelle: loyerEnRetardDe(ligne.locataire?.prenom ?? TEXTES_GERER.tonLocataire),
        precision: bienEtChambre(ligne.bien?.nom ?? '', ligne.location.libelle),
        point: 'bg-probleme',
      };
    }
    case 'vacant':
      return {
        vers: lienNouveauLocataire({ bienId: action.bien.id, retour: CHEMIN_GERER }),
        libelle: louerLeBien(action.bien.nom),
        point: 'bg-accent',
      };
    case 'pret':
      // La carte Argent de la fiche propose « Enregistrer ce prêt » (clic 2).
      return {
        vers: lienFicheBien(action.bien.id),
        libelle: enregistrerLePretDe(action.bien.nom),
        point: 'bg-accent',
      };
    case 'email': {
      const { locataire } = action;
      return {
        vers: lienFicheLocataire(locataire.id, { modifier: true }),
        libelle: ajouterEmailDe(`${locataire.prenom} ${locataire.nom}`),
        point: 'bg-surveiller',
      };
    }
    case 'alerte':
      return {
        vers: lienConformite(action.bien.id),
        libelle: alerteAFaire(action.alerte, action.bien.nom),
        point: action.alerte.code === 'fin_bail_court' ? 'bg-surveiller' : 'bg-probleme',
      };
    case 'depot':
      return {
        vers: lienFinBail(action.bien.id, action.location.id),
        libelle: depotAFaire(
          action.locataire?.prenom ?? TEXTES_GERER.tonLocataire,
          action.suivi.dateLimite ?? '',
        ),
        precision: bienEtChambre(action.bien.nom, action.location.libelle),
        point: action.suivi.enRetard ? 'bg-probleme' : 'bg-surveiller',
      };
    case 'regularisation':
      return {
        vers: lienFinBail(action.bien.id, action.location.id),
        libelle: soldeEnLettres(
          action.annee,
          action.solde,
          action.locataire?.prenom ?? TEXTES_GERER.tonLocataire,
        ),
        precision: bienEtChambre(action.bien.nom, action.location.libelle),
        point: 'bg-accent',
      };
    case 'charges_a_regler':
      return {
        vers: lienFinBail(action.bien.id, action.location.id),
        libelle: soldeEnLettres(
          action.regularisation.annee,
          action.regularisation.solde,
          action.locataire?.prenom ?? TEXTES_GERER.tonLocataire,
        ),
        precision: echeanceEnLettres(action.regularisation.aPartirDe),
        point: 'bg-surveiller',
      };
    case 'revision':
      return {
        vers: lienRevision(action.bien.id, action.location.id),
        libelle: revisionAFaire(
          action.locataire?.prenom ?? TEXTES_GERER.tonLocataire,
          action.proposition,
        ),
        precision: bienEtChambre(action.bien.nom, action.location.libelle),
        point: 'bg-accent',
      };
  }
}

/**
 * « À faire », en haut des loyers du mois (G1-6) : trois actions au plus, la plus urgente d'abord,
 * chacune à un clic ; « Voir les N autres » montre la suite. Rien quand tout va bien.
 */
export function AFaire({
  actions,
}: {
  readonly actions: readonly ActionAFaire[];
}): JSX.Element | null {
  const [tout, setTout] = useState(false);
  if (actions.length === 0) return null;
  const visibles = tout ? actions : actions.slice(0, A_FAIRE_VISIBLES);
  const cachees = actions.length - visibles.length;

  return (
    <Carte>
      <TitreCarte>{T.titre}</TitreCarte>
      <ul aria-label={T.titre} className="m-0 flex list-none flex-col p-0">
        {visibles.map((action) => {
          const { vers, libelle, precision, point } = ligneDe(action);
          return (
            <li
              key={cleAction(action)}
              className="flex items-center gap-3 border-t border-bordure-douce first:border-t-0"
            >
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${point}`} />
              <Link
                to={vers}
                className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 py-1.5 font-semibold text-encre no-underline survol-texte"
              >
                <span>{libelle}</span>
                {/* Commentaire secondaire (le bien) : `small`, pour ne pas se confondre avec la ligne du loyer. */}
                {precision !== undefined && (
                  <small className="text-sm font-normal text-encre-3">{precision}</small>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {cachees > 0 && (
        <div>
          <Bouton
            onClick={() => {
              setTout(true);
            }}
          >
            {voirLesAutres(cachees)}
          </Bouton>
        </div>
      )}
    </Carte>
  );
}
