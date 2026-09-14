import { obtenirRegles, VERSION_REGLES_COURANTE, type ModeLocation } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import { useClientWorker } from '@/coque/ClientWorker';
import { loyerPourBien, loyerVise } from '@/enrichissement';
import { PHRASES_DONNEES_ADRESSE, phraseLoyer } from '@/textes/donnees-adresse';

import { nombre, type Valeurs } from './valeurs';

export const PHRASES_ESTIMER_LOYER = {
  indisponible: 'Loyer de marché indisponible pour le moment : saisissez le loyer visé.',
  incomplet: 'Indiquez d’abord le code postal, la ville et la surface.',
} as const;

/**
 * « Estimer le loyer » : situe la ville, lit le loyer de marché ANIL de la commune et propose le loyer visé
 * selon la surface et le mode de location. Le champ reste modifiable.
 */
export function EstimerLoyer({
  valeurs,
  onEstime,
}: {
  valeurs: Valeurs;
  onEstime: (loyer: string) => void;
}): JSX.Element {
  const client = useClientWorker();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const surface = nombre(valeurs.surface);
  const codePostal = valeurs.codePostal.trim();
  const complet = /^\d{5}$/.test(codePostal) && valeurs.ville.trim() !== '' && (surface ?? 0) > 0;

  const estimer = async (): Promise<void> => {
    if (!complet || surface === undefined) {
      setMessage(PHRASES_ESTIMER_LOYER.incomplet);
      return;
    }
    setEnCours(true);
    const lieu = await client.geocoder(`${codePostal} ${valeurs.ville.trim()}`, codePostal);
    const codeInsee = lieu.ok ? (lieu.valeur?.codeInsee ?? null) : null;
    const marche =
      codeInsee === null
        ? null
        : await client.marche({
            codeInsee,
            codePostal,
            type: valeurs.typeBien === 'maison' ? 'maison' : 'appartement',
            pieces: nombre(valeurs.pieces),
          });
    setEnCours(false);
    if (!marche?.ok) {
      setMessage(PHRASES_ESTIMER_LOYER.indisponible);
      return;
    }
    if (marche.valeur.loyer === null) {
      setMessage(PHRASES_DONNEES_ADRESSE.loyerIndisponible);
      return;
    }
    const prime = obtenirRegles(VERSION_REGLES_COURANTE).exploitation.primeMeuble;
    const loyer = loyerPourBien(marche.valeur.loyer, surface, prime);
    onEstime(String(loyerVise(loyer, valeurs.mode as ModeLocation)));
    setMessage(`Loyer de marché (ANIL) : ${phraseLoyer(loyer)}`);
  };

  return (
    <div className="col-span-3 flex flex-wrap items-center gap-3 px-2">
      <Bouton
        disabled={enCours}
        onClick={() => {
          void estimer();
        }}
      >
        {enCours ? 'Estimation…' : 'Estimer le loyer'}
      </Bouton>
      {message !== null && <span className="text-sm text-encre-2">{message}</span>}
    </div>
  );
}
