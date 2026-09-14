import {
  CHAMP_LOYER_PAR_MODE,
  LocationSchema,
  ModeLocationSchema,
  defautsPourMode,
  loyerConnu,
  loyerMensuelReference,
  obtenirRegles,
  regimesCompatibles,
  type LocationComplete,
  type LocationEntree,
  type ModeLocation,
  type ProjetEntree,
} from '@loupe/moteur';

import { ecrireChemin } from './chemins';
import { depuisTexte, type Conversion } from './conversion';
import { cleProvenance, type Descripteur } from './descripteurs';
import { CHEMIN_MODE } from './groupes-location';

export type Application =
  | { readonly ok: true; readonly projet: ProjetEntree }
  | { readonly ok: false; readonly erreur: string };

type Provenance = Record<string, string>;

/** Les valeurs de départ du nouveau type sont « estimées » ; celles de l'ancien type ne valent plus. */
function provenanceDuType(
  actuelle: Provenance,
  location: Readonly<Record<string, unknown>>,
): Provenance {
  const conservee = Object.fromEntries(
    Object.entries(actuelle).filter(([cle]) => !cle.startsWith('location.')),
  );
  const estimee = Object.fromEntries(
    Object.keys(location)
      .filter((cle) => cle !== 'mode')
      .map((cle) => [`location.${cle}`, 'estime']),
  );
  return { ...conservee, ...estimee, 'location.mode': 'utilisateur' };
}

/** La variante sans son champ de loyer (loyer, loyer par chambre ou nuitée). */
function sansLoyer(location: LocationComplete): LocationEntree {
  const cle = CHAMP_LOYER_PAR_MODE[location.mode];
  return Object.fromEntries(Object.entries(location).filter(([k]) => k !== cle)) as LocationEntree;
}

/**
 * Changer de type d'exploitation reconstruit la location avec les défauts du type, à partir du loyer
 * de référence de l'ancienne ; les abonnements du propriétaire suivent le type sauf s'ils sont à toi ;
 * le régime retenu reste compatible (sinon, réel meublé).
 */
function changerDeType(projet: ProjetEntree, mode: ModeLocation): ProjetEntree {
  const regles = obtenirRegles(projet.versionRegles);
  const actuelle = LocationSchema.safeParse(projet.hypotheses.location);
  // Sans loyer connu, le nouveau type n'en reçoit pas non plus : le rapport le demandera.
  const loyerMensuel =
    actuelle.success && loyerConnu(actuelle.data)
      ? loyerMensuelReference(actuelle.data, regles)
      : null;
  const chambres = projet.bien.chambres ?? Math.max(1, projet.bien.pieces - 1);
  const defauts = defautsPourMode(mode, regles, { loyerMensuel: loyerMensuel ?? 0, chambres });
  const location = loyerMensuel === null ? sansLoyer(defauts.location) : defauts.location;
  const charges = projet.hypotheses.charges ?? {};
  const provenance: Provenance = { ...(projet.provenance ?? {}) };
  const abonnement = (cle: 'energieMensuel' | 'internetMensuel'): number => {
    if (provenance[`charges.${cle}`] === 'utilisateur') return charges[cle] ?? 0;
    provenance[`charges.${cle}`] = 'estime';
    return defauts.charges[cle];
  };
  const { regime } = projet.hypotheses.fiscalite;
  return {
    ...projet,
    hypotheses: {
      ...projet.hypotheses,
      location,
      charges: {
        ...charges,
        energieMensuel: abonnement('energieMensuel'),
        internetMensuel: abonnement('internetMensuel'),
      },
      fiscalite: {
        ...projet.hypotheses.fiscalite,
        regime: regimesCompatibles(mode).includes(regime) ? regime : 'lmnp_reel',
      },
    },
    provenance: provenanceDuType(provenance, location),
  };
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
  if (descripteur.chemin === CHEMIN_MODE) {
    const mode = ModeLocationSchema.safeParse(conversion.valeur);
    if (!mode.success) return { ok: false, erreur: 'Type de location inconnu.' };
    if (mode.data === projet.hypotheses.location.mode) return { ok: true, projet };
    return { ok: true, projet: changerDeType(projet, mode.data) };
  }
  const suivant = ecrireChemin(projet, descripteur.chemin, conversion.valeur);
  // Les clés de provenance contiennent des points (« pret.tauxNominal ») : écriture directe, pas par chemin.
  return {
    ok: true,
    projet: {
      ...suivant,
      provenance: {
        ...(suivant.provenance ?? {}),
        [cleProvenance(descripteur.chemin)]: 'utilisateur',
      },
    },
  };
}
