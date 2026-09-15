import { JOURS_PAR_MOIS, type ModeLocation } from '@loupe/moteur';
import type { JSX } from 'react';

import { Curseur } from '@/composants/Curseur';
import { pourcentage } from '@/formatage/nombres';

import { CompteurChamp, Montant } from './Commandes';
import type { ContexteFormulaire } from './contexte';
import { EstimerLoyer } from './EstimerLoyer';
import { nombre } from './valeurs';

const nuits = (n: number): string =>
  `${String(n)} nuit${n > 1 ? 's' : ''} · ${pourcentage(n / JOURS_PAR_MOIS, 0)}`;

/** Les champs du loyer du type de location choisi, puis « Estimer le loyer » (sauf en courte durée). */
export function ChoixLoyer({ c }: { c: ContexteFormulaire }): JSX.Element {
  const mode = c.valeurs.mode as ModeLocation;
  const nuitsParMois = nombre(c.valeurs.nuiteesParMois);
  return (
    <>
      {(mode === 'nu' || mode === 'meuble' || mode === 'moyenne_duree') && (
        <Montant
          c={c}
          cle="loyerHc"
          libelle="Loyer visé, hors charges"
          unite="€/mois"
          aToi
          terme="loyerHc"
        />
      )}
      {mode === 'colocation' && (
        <>
          <CompteurChamp
            c={c}
            cle="chambresLouees"
            libelle="Chambres louées"
            aToi
            min={1}
            max={20}
            moins="Une chambre louée de moins"
            plus="Une chambre louée de plus"
          />
          <Montant
            c={c}
            cle="loyerChambre"
            libelle="Loyer par chambre, hors charges"
            unite="€/mois"
            aToi
            terme="loyerHc"
          />
        </>
      )}
      {mode === 'courte_duree' && (
        <>
          <Montant c={c} cle="nuitee" libelle="Prix de la nuitée, hors ménage" unite="€" aToi />
          <div className="col-span-full flex flex-col gap-1 rounded-encart bg-accent-fond p-2">
            <Curseur
              libelle="Nuits louées par mois"
              valeur={nuitsParMois ?? null}
              min={0}
              max={31}
              formater={nuits}
              reperes={[0, 10, 20, 31]}
              onChangement={(n) => {
                c.changer('nuiteesParMois', String(n));
              }}
            />
            {c.erreurs.nuiteesParMois !== undefined && (
              <span className="text-xs text-probleme">{c.erreurs.nuiteesParMois}</span>
            )}
          </div>
        </>
      )}
      <EstimerLoyer valeurs={c.valeurs} onEstime={c.loyerEstime} />
    </>
  );
}
