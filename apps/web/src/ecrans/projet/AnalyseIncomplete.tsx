import { obtenirRegles, type Manque } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { Bouton, Carte } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { ChampHypothese } from '@/ecrans/hypotheses/ChampHypothese';
import { appliquerLoyerDeReference, loyerDeReference } from '@/enrichissement';
import { euros } from '@/formatage/nombres';
import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';
import { MANQUES, TEXTES_A_COMPLETER } from '@/textes/manques';

/**
 * « Il manque … pour cette analyse » : le bandeau d'un onglet privé d'une donnée, avec le champ
 * à remplir sur place (appliqué d'un clic ou d'un Entrée : le bandeau disparaît dès que la valeur
 * est enregistrée) et, quand la commune est connue, le loyer de marché en un clic.
 * Dans un document (impression, partage), la phrase seule.
 */
export function AnalyseIncomplete({ manque }: { manque: Manque }): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const document = useModeDocument();
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | undefined>(undefined);
  const t = MANQUES[manque.code];
  const descripteur = descripteurParChemin(manque.champ);
  const regles = obtenirRegles(enregistre.projet.versionRegles);
  const reference =
    manque.code === 'LOYER_ABSENT'
      ? loyerDeReference(enregistre.projet, regles.exploitation.primeMeuble)
      : null;

  const appliquer = (): void => {
    const application = appliquerSaisie(enregistre.projet, descripteur, texte);
    if (!application.ok) {
      setErreur(application.erreur);
      return;
    }
    const resultat = mettreAJour(enregistre.id, application.projet);
    setErreur(
      resultat.ok
        ? undefined
        : (resultat.erreurs[manque.champ] ??
            Object.values(resultat.erreurs)[0] ??
            'Valeur refusée.'),
    );
  };

  return (
    <Carte className="border-accent-bordure bg-accent-fond">
      <h2 className="m-0 font-display text-[22px] font-semibold">{t.titre}</h2>
      <p className="m-0 text-[15px] text-encre-2">{t.phrase}</p>
      {!document && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            appliquer();
          }}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="sm:w-[320px] sm:max-w-full">
            <ChampHypothese
              descripteur={descripteur}
              texte={texte}
              erreur={erreur}
              badge={null}
              onChange={(saisie) => {
                setTexte(saisie);
                setErreur(undefined);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2 pb-2">
            <Bouton variante="primaire" type="submit">
              {TEXTES_A_COMPLETER.appliquer}
            </Bouton>
            {reference !== null && (
              <Bouton
                onClick={() => {
                  mettreAJour(
                    enregistre.id,
                    appliquerLoyerDeReference(enregistre.projet, reference),
                  );
                }}
              >
                {TEXTES_A_COMPLETER.boutonLoyerMarche} {euros(reference)}
              </Bouton>
            )}
          </div>
        </form>
      )}
    </Carte>
  );
}
