import type { AlerteConformite, BienGere, EtatGestion, LegalBienSaisie } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, Carte, Ligne, Pastille, TitreCarte } from '@/composants/ui';
import { useBail } from '@/gestion/bail/BailContext';
import { alertesDuBien, legalDuBien } from '@/gestion/bail/vue';
import { ANCRE_CONFORMITE } from '@/gestion/parcours';
import {
  alerteEnLettres,
  dpeEnLettres,
  ERREURS_BAIL,
  PROVENANCES,
  TEXTES_BAIL,
  TEXTES_CONFORMITE as T,
  zoneEnLettres,
} from '@/textes/gerer-bail';

import { ModifierConformite } from './ModifierConformite';

const POINT_ALERTE: Readonly<Record<AlerteConformite['code'], string>> = {
  location_interdite: 'bg-probleme',
  dpe_perime: 'bg-probleme',
  location_interdite_bientot: 'bg-surveiller',
  fin_bail_court: 'bg-surveiller',
  dpe_manquant: 'bg-surveiller',
};

/** « Conformité » sur la fiche d'un bien (G4-5) : DPE, zone tendue, alertes datées et sourcées. */
export function CarteConformite({
  bien,
  donnees,
  aujourdhui,
}: {
  readonly bien: BienGere;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
}): JSX.Element | null {
  const bail = useBail();
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (bail.statut === 'anonyme') return null;

  const enregistrer = async (saisie: LegalBienSaisie): Promise<void> => {
    setOccupe(true);
    const r = await bail.enregistrerBien(bien.id, saisie);
    setOccupe(false);
    if (r.ok) {
      setOuvert(false);
      setErreur(null);
    } else {
      setErreur(ERREURS_BAIL[r.code]);
    }
  };

  const etat = bail.donnees;
  const legal = etat === null ? null : legalDuBien(bien, etat);
  const alertes = etat === null ? [] : alertesDuBien(bien, donnees, etat, aujourdhui);

  return (
    <Carte id={ANCRE_CONFORMITE}>
      <TitreCarte
        action={
          legal !== null && !ouvert ? (
            <Bouton
              onClick={() => {
                setOuvert(true);
              }}
            >
              {T.modifier}
            </Bouton>
          ) : undefined
        }
      >
        {T.titre}
      </TitreCarte>
      {bail.statut === 'chargement' && <p className="m-0 text-encre-3">{TEXTES_BAIL.chargement}</p>}
      {bail.statut === 'indisponible' && (
        <p className="m-0 text-encre-2">{TEXTES_BAIL.indisponible}</p>
      )}
      {bail.statut === 'erreur' && bail.erreur !== null && (
        <p className="m-0 text-encre-2">{ERREURS_BAIL[bail.erreur]}</p>
      )}
      {legal !== null && (
        <>
          <div>
            {/* Valeur longue (« Classe D, réalisé le 1er mars 2024 ») : elle passe à la ligne sur téléphone. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-bordure-douce py-2 text-[15px]">
              <span>{T.dpe}</span>
              <span className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-right">
                <span>{dpeEnLettres(legal.dpeClasse, legal.dpeDate)}</span>
                {legal.provenance !== 'aucune' && (
                  <Pastille ton="neutre" compacte>
                    {PROVENANCES[legal.provenance]}
                  </Pastille>
                )}
              </span>
            </div>
            <Ligne libelle={T.zoneTendue} valeur={zoneEnLettres(legal.zoneTendue)} />
          </div>
          {ouvert && (
            <ModifierConformite
              id={`conformite-${bien.id}`}
              legal={legal}
              occupe={occupe}
              erreur={erreur}
              onEnregistrer={enregistrer}
              onFermer={() => {
                setOuvert(false);
                setErreur(null);
              }}
            />
          )}
          {alertes.length === 0 ? (
            <p className="m-0 text-encre-2">{T.rienASignaler}</p>
          ) : (
            <ul aria-label={T.alertes} className="m-0 flex list-none flex-col gap-2 p-0">
              {alertes.map((alerte) => (
                <li
                  key={`${alerte.code}-${'locationId' in alerte ? alerte.locationId : ''}`}
                  className="flex items-start gap-3"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-2 size-2 shrink-0 rounded-full ${POINT_ALERTE[alerte.code]}`}
                  />
                  <p className="m-0 text-[15px]">{alerteEnLettres(alerte)}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 text-sm text-encre-3">
            {T.sources} {T.aSuivre}
          </p>
        </>
      )}
    </Carte>
  );
}
