import type { ProjetEntree, QuestionPosee } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { useProjetCourant } from '@/coque/ProjetLayout';
import { appliquerSaisie, valeurActuelle, versTexte, type Descripteur } from '@/hypotheses';
import { useProjets } from '@/stockage/ProjetsContext';
import { reponseDe, repondre, visiteDe } from '@/visite';

import { ChampHypothese } from '../hypotheses/ChampHypothese';
import { badgePour } from '../hypotheses/badges';

/**
 * Le champ d'une question à valeur : la même saisie que l'onglet Hypothèses (validation,
 * provenance « à toi »), et une valeur renseignée passe la question à « OK ».
 */
export function ChampValeur({
  question,
  descripteur,
}: {
  question: QuestionPosee;
  descripteur: Descripteur;
}): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const projet: ProjetEntree = enregistre.projet;
  const [texte, setTexte] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | undefined>(undefined);

  const changer = (saisie: string): void => {
    setTexte(saisie);
    const application = appliquerSaisie(projet, descripteur, saisie);
    if (!application.ok) {
      setErreur(application.erreur);
      return;
    }
    const visite = visiteDe(enregistre);
    const renseignee = saisie.trim() !== '' && reponseDe(visite, question.id).etat === 'a_verifier';
    const resultat = mettreAJour(enregistre.id, application.projet, {
      visite: renseignee ? repondre(visite, question.id, 'ok') : visite,
    });
    if (!resultat.ok) {
      const message =
        resultat.erreurs[descripteur.chemin] ??
        Object.values(resultat.erreurs)[0] ??
        'Valeur refusée.';
      setErreur(message);
      return;
    }
    setErreur(undefined);
  };

  return (
    <div className="max-w-[360px]">
      <ChampHypothese
        descripteur={descripteur}
        texte={texte ?? versTexte(valeurActuelle(projet, descripteur), descripteur.type)}
        erreur={erreur}
        badge={badgePour(projet, descripteur)}
        onChange={changer}
      />
    </div>
  );
}
