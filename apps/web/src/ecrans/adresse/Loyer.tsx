import { loyerMensuelHc, obtenirRegles } from '@loupe/moteur';
import type { JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  appliquerLoyerVise,
  loyerPourBien,
  loyerVise,
  type ReponseMarche,
  type Resultat,
} from '@/enrichissement';
import { euros } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import { PHRASES_DONNEES_ADRESSE, phraseLoyer } from '@/textes/donnees-adresse';

/** Loyer d'annonce ANIL ramené au bien ; il sert de loyer de référence, et devient le loyer visé sur clic. */
export function CarteLoyer({ resultat }: { resultat: Resultat<ReponseMarche> }): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const { projet } = enregistre;
  const anil = resultat.ok ? resultat.valeur.loyer : null;

  if (anil === null) {
    return (
      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">Le loyer de marché</h2>
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_DONNEES_ADRESSE.loyerIndisponible}</p>
      </Carte>
    );
  }
  const regles = obtenirRegles(projet.versionRegles);
  const loyer = loyerPourBien(anil, projet.bien.surface, regles.exploitation.primeMeuble);
  const vise = loyerVise(loyer, projet.hypotheses.location.mode);
  const sources = resultat.ok ? resultat.valeur.sources : [];
  const mention = sources.find((s) => s.mention !== undefined)?.mention;

  return (
    <Carte>
      <h2 className="m-0 font-display text-[22px] font-semibold">Le loyer de marché</h2>
      <p className="m-0 text-[17px]">{phraseLoyer(loyer)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[15px] text-encre-2">
          Loyer visé du projet :{' '}
          <strong>{euros(loyerMensuelHc(projet.hypotheses.location))}</strong>
        </span>
        {loyerMensuelHc(projet.hypotheses.location) === vise ? (
          <Pastille ton="bon" compacte>
            {PHRASES_DONNEES_ADRESSE.loyerApplique}
          </Pastille>
        ) : (
          <Bouton
            onClick={() => {
              mettreAJour(enregistre.id, appliquerLoyerVise(projet, loyer));
            }}
          >
            Utiliser {euros(vise)} comme loyer visé
          </Bouton>
        )}
      </div>
      <p className="m-0 text-xs text-encre-3">
        Loyers d'annonce de la commune, charges comprises, moins 8 % de charges ; meublé : plus{' '}
        {Math.round(regles.exploitation.primeMeuble * 100)} %.{' '}
        {mention ?? 'Source : carte des loyers, ANIL.'}
      </p>
    </Carte>
  );
}
