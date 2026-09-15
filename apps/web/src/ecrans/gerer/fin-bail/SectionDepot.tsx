import { jourLocal, type LocationGeree, type RestitutionSaisie } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, LienBouton, Ligne } from '@/composants/ui';
import { useFinBail } from '@/gestion/fin-bail/FinBailContext';
import { depotDe, restitutionDe } from '@/gestion/fin-bail/vue';
import { dateEnLettres, montant } from '@/gestion/format';
import { lienDecompte } from '@/gestion/parcours';
import {
  aRendreAvant,
  ERREURS_FIN_BAIL,
  majorationEnLettres,
  rendreTout,
  TEXTES_DEPOT as T,
} from '@/textes/gerer-fin-bail';

import { FormulaireRetenues } from './FormulaireRetenues';

/**
 * Le dépôt de garantie d'une location terminée (G4-3) : ce qu'il reste à rendre, la date limite, la
 * majoration de retard, le décompte figé. Deux clics depuis « À faire » : la ligne, puis « Conforme ».
 */
export function SectionDepot({
  location,
  aujourdhui,
  retour,
}: {
  readonly location: LocationGeree;
  readonly aujourdhui: string;
  /** La page où revenir depuis le décompte. */
  readonly retour: string;
}): JSX.Element | null {
  const finBail = useFinBail();
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const etat = finBail.donnees;
  if (etat === null) return null;

  const suivi = depotDe(location, etat, aujourdhui);
  const restitution = restitutionDe(etat, location.id);
  if (suivi.statut === 'sans_depot') {
    return <p className="m-0 text-sm text-encre-3">{T.sansDepot}</p>;
  }
  if (suivi.statut === 'en_cours') {
    return (
      <div className="flex flex-col gap-1">
        <Ligne libelle={T.titre} valeur={montant(location.depot)} />
        <p className="m-0 text-sm text-encre-3">{T.enCours}</p>
      </div>
    );
  }

  const conclure = (r: { readonly ok: boolean; readonly code?: string }): void => {
    setOccupe(false);
    if (r.ok) {
      setOuvert(false);
      setErreur(null);
    } else setErreur(ERREURS_FIN_BAIL[(r.code ?? 'inconnue') as keyof typeof ERREURS_FIN_BAIL]);
  };
  const restituer = async (saisie: RestitutionSaisie): Promise<void> => {
    setOccupe(true);
    const r = await finBail.restituer(location.id, saisie);
    conclure(r.ok ? { ok: true } : { ok: false, code: r.code });
  };
  const conforme = (): void => {
    void restituer({
      clesLe: suivi.dateLimite === null ? aujourdhui : (location.fin ?? aujourdhui),
      conforme: true,
      retenues: [],
    });
  };
  const rendre = async (): Promise<void> => {
    setOccupe(true);
    const r = await finBail.rendreDepot(location.id, jourLocal(new Date()));
    conclure(r.ok ? { ok: true } : { ok: false, code: r.code });
  };
  const annuler = async (): Promise<void> => {
    setOccupe(true);
    const r = await finBail.annulerRestitution(location.id);
    conclure(r.ok ? { ok: true } : { ok: false, code: r.code });
  };

  return (
    <div className="flex flex-col gap-2">
      <Ligne libelle={T.titre} valeur={montant(location.depot)} />
      <p className="m-0 font-semibold">
        {suivi.dateLimite === null ? '' : aRendreAvant(suivi.aRendre, suivi.dateLimite)}
      </p>
      {suivi.majoration.montant > 0 && (
        <p className="m-0 text-sm text-probleme-texte">{majorationEnLettres(suivi.majoration)}</p>
      )}
      {(restitution?.rendueLe ?? null) !== null && (
        <p className="m-0 text-sm text-encre-2">{`${T.rendreLe} ${dateEnLettres(String(restitution?.rendueLe))}`}</p>
      )}

      {ouvert && location.fin !== undefined && (
        <FormulaireRetenues
          id={`retenues-${location.id}`}
          sortie={location.fin}
          aujourdhui={aujourdhui}
          occupe={occupe}
          erreur={erreur}
          onEnregistrer={restituer}
          onFermer={() => {
            setOuvert(false);
            setErreur(null);
          }}
        />
      )}

      {!ouvert && (
        <div className="flex flex-wrap gap-2">
          {restitution === undefined ? (
            <>
              <Bouton variante="primaire" disabled={occupe} onClick={conforme}>
                {rendreTout(suivi.aRendre)}
              </Bouton>
              <Bouton
                onClick={() => {
                  setOuvert(true);
                }}
              >
                {T.retenues}
              </Bouton>
            </>
          ) : (
            <>
              <LienBouton to={lienDecompte(restitution.decompteId, retour)}>
                {T.voirDecompte}
              </LienBouton>
              {restitution.rendueLe === null && (
                <>
                  <Bouton variante="primaire" disabled={occupe} onClick={() => void rendre()}>
                    {T.marquerRendu}
                  </Bouton>
                  <Bouton disabled={occupe} onClick={() => void annuler()}>
                    {T.annuler}
                  </Bouton>
                </>
              )}
            </>
          )}
        </div>
      )}
      <p className="m-0 text-sm text-encre-3">{T.source}</p>
      {!ouvert && erreur !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}
    </div>
  );
}
