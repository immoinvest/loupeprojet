import type { ProjetEntree } from '@loupe/moteur';

import { ecrireChemin, lireChemin } from './chemins';
import { depuisTexte, type Conversion } from './conversion';
import { cleProvenance, type Descripteur } from './descripteurs';

export type Application =
  | { readonly ok: true; readonly projet: ProjetEntree }
  | { readonly ok: false; readonly erreur: string };

const OCCUPATION_DEFAUT = 0.6;

/** Un passage en courte durée sans nuitée connue reçoit des valeurs de départ plausibles. */
function preparerCourteDuree(projet: ProjetEntree): ProjetEntree {
  if (lireChemin(projet, 'hypotheses.location.courteDuree') !== undefined) return projet;
  const loyer = Number(lireChemin(projet, 'hypotheses.location.loyerHc'));
  const nuitee = Math.max(30, Math.round((loyer / 30) * 2));
  return ecrireChemin(projet, 'hypotheses.location.courteDuree', {
    nuitee,
    tauxOccupation: OCCUPATION_DEFAUT,
  });
}

/** La première valeur de marché saisie crée le bloc DVF avec un nombre de ventes à 0. */
function preparerDvf(projet: ProjetEntree, chemin: string): ProjetEntree {
  if (!chemin.startsWith('marche.dvf.') || lireChemin(projet, 'marche.dvf') !== undefined) {
    return projet;
  }
  return ecrireChemin(projet, 'marche.dvf', { medianM2: 1, nombreVentes: 0 });
}

/**
 * Applique une saisie texte à un projet : conversion, contrôle « obligatoire »,
 * préparations, écriture immuable et provenance « utilisateur ».
 */
export function appliquerSaisie(
  projet: ProjetEntree,
  descripteur: Descripteur,
  texte: string,
): Application {
  const conversion: Conversion = depuisTexte(texte, descripteur.type);
  if (!conversion.ok) return conversion;
  if (conversion.valeur === undefined && descripteur.obligatoire === true) {
    return { ok: false, erreur: 'Cette valeur est nécessaire au calcul.' };
  }
  let prepare = preparerDvf(projet, descripteur.chemin);
  let suivant = ecrireChemin(prepare, descripteur.chemin, conversion.valeur);
  if (descripteur.chemin === 'hypotheses.location.mode' && conversion.valeur === 'courte_duree') {
    suivant = preparerCourteDuree(suivant);
  }
  // Les clés de provenance contiennent des points (« pret.tauxNominal ») : écriture directe, pas par chemin.
  prepare = {
    ...suivant,
    provenance: {
      ...(suivant.provenance ?? {}),
      [cleProvenance(descripteur.chemin)]: 'utilisateur',
    },
  };
  return { ok: true, projet: prepare };
}
