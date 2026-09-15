import { jourLocal, type EtatGestion, type LocationGeree } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, LienBouton, Ligne } from '@/composants/ui';
import { useArgent } from '@/gestion/argent/ArgentContext';
import { useFinBail } from '@/gestion/fin-bail/FinBailContext';
import {
  anneesProposees,
  modeChargesDe,
  propositionCharges,
  regularisationsDe,
} from '@/gestion/fin-bail/vue';
import { dateEnLettres, montant } from '@/gestion/format';
import { lienDecompte } from '@/gestion/parcours';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';
import {
  echeanceEnLettres,
  ERREURS_FIN_BAIL,
  soldeEnLettres,
  TEXTES_CHARGES as T,
  TEXTES_DEPOT,
} from '@/textes/gerer-fin-bail';

/**
 * La régularisation annuelle des charges d'une location (G4-4) : provisions contre dépenses
 * récupérables, « Valider la régularisation », puis l'échéance à régler. Forfait : jamais proposée.
 */
export function SectionCharges({
  location,
  donnees,
  aujourdhui,
  retour,
}: {
  readonly location: LocationGeree;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
  readonly retour: string;
}): JSX.Element | null {
  const finBail = useFinBail();
  const argent = useArgent();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const etat = finBail.donnees;
  if (etat === null) return null;

  const depenses = argent.donnees?.depenses ?? [];
  const mode = modeChargesDe(etat, location.id);
  const validees = regularisationsDe(etat, location.id);
  const prenom =
    donnees.locataires.find((l) => l.id === location.locataireId)?.prenom ??
    TEXTES_GERER.tonLocataire;
  const propositions = anneesProposees(location, etat, aujourdhui).map((annee) => ({
    annee,
    proposition: propositionCharges(location, donnees, etat, depenses, annee),
  }));

  const conclure = (ok: boolean, code?: string): void => {
    setOccupe(false);
    setErreur(ok ? null : ERREURS_FIN_BAIL[(code ?? 'inconnue') as keyof typeof ERREURS_FIN_BAIL]);
  };
  const valider = async (annee: number): Promise<void> => {
    setOccupe(true);
    const r = await finBail.regulariser(location.id, annee);
    conclure(r.ok, r.ok ? undefined : r.code);
  };
  const regler = async (id: string): Promise<void> => {
    setOccupe(true);
    const r = await finBail.reglerRegularisation(id, jourLocal(new Date()));
    conclure(r.ok, r.ok ? undefined : r.code);
  };
  const changerMode = async (): Promise<void> => {
    setOccupe(true);
    const r = await finBail.enregistrerModeCharges(
      location.id,
      mode === 'forfait' ? 'provision' : 'forfait',
    );
    conclure(r.ok, r.ok ? undefined : r.code);
  };

  return (
    <div className="flex flex-col gap-2">
      {mode === 'forfait' ? (
        <p className="m-0 text-sm text-encre-2">{T.forfait}</p>
      ) : (
        propositions.map(({ annee, proposition }) => (
          <div key={annee} className="flex flex-col gap-1">
            {proposition.statut === 'proposee' ? (
              <>
                <p className="m-0 font-semibold">
                  {soldeEnLettres(annee, proposition.solde, prenom)}
                </p>
                <Ligne libelle={T.provisions} valeur={montant(proposition.provisions)} />
                <Ligne libelle={T.reelles} valeur={montant(proposition.totalCharges)} />
                <div>
                  <Bouton variante="primaire" disabled={occupe} onClick={() => void valider(annee)}>
                    {T.valider}
                  </Bouton>
                </div>
              </>
            ) : (
              <p className="m-0 text-sm text-encre-3">
                {proposition.statut === 'sans_depenses' ? T.sansDepense : T.rienARegulariser}
              </p>
            )}
          </div>
        ))
      )}
      {mode === 'provision' && propositions.length === 0 && validees.length === 0 && (
        <p className="m-0 text-sm text-encre-3">{T.rienARegulariser}</p>
      )}

      {validees.map((regularisation) => (
        <div key={regularisation.id} className="flex flex-col gap-1">
          <p className="m-0 font-semibold">
            {soldeEnLettres(regularisation.annee, regularisation.solde, prenom)}
          </p>
          <p className="m-0 text-sm text-encre-2">
            {regularisation.regleeLe === null
              ? echeanceEnLettres(regularisation.aPartirDe)
              : `${T.regleeLe} ${dateEnLettres(regularisation.regleeLe)}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <LienBouton to={lienDecompte(regularisation.decompteId, retour)}>
              {TEXTES_DEPOT.voirDecompte}
            </LienBouton>
            {regularisation.regleeLe === null && (
              <Bouton disabled={occupe} onClick={() => void regler(regularisation.id)}>
                {T.marquerReglee}
              </Bouton>
            )}
          </div>
        </div>
      ))}

      <div>
        <Bouton disabled={occupe} onClick={() => void changerMode()}>
          {mode === 'forfait' ? T.passerAuxProvisions : T.passerAuForfait}
        </Bouton>
      </div>
      <p className="m-0 text-sm text-encre-3">{T.source}</p>
      {erreur !== null && (
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
