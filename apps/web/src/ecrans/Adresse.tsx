import { useEffect, useState, type JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useClientWorker } from '@/coque/ClientWorker';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  ecartAuRepere,
  lireCleBan,
  marcheDepuisReference,
  type ReponseAdresse,
} from '@/enrichissement';
import { useProjets } from '@/stockage/ProjetsContext';
import type { AdresseBien } from '@/stockage/projets';
import { PHRASES_ADRESSE, phrasePrecision, phraseReference } from '@/textes/adresse';

import { CarteEstimation } from './adresse/Estimation';
import { TableauGroupes, TableauVentes } from './adresse/Tableaux';
import { Tendance } from './adresse/Tendance';

type Etat =
  | { readonly etape: 'saisie' }
  | { readonly etape: 'recherche' }
  | { readonly etape: 'erreur'; readonly message: string }
  | { readonly etape: 'resultat'; readonly adresse: AdresseBien; readonly analyse: ReponseAdresse };

export function Adresse(): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const client = useClientWorker();
  const [texte, setTexte] = useState(enregistre.adresse?.libelle ?? '');
  const [etat, setEtat] = useState<Etat>({ etape: 'saisie' });
  const { projet } = enregistre;

  const analyser = async (adresse: AdresseBien): Promise<void> => {
    setEtat({ etape: 'recherche' });
    const analyse = await client.analyserAdresse({
      codeInsee: adresse.codeInsee,
      lat: adresse.lat,
      lon: adresse.lon,
      numero: adresse.numero,
      codeVoie: adresse.codeVoie,
      type: projet.bien.type,
      surface: projet.bien.surface,
    });
    setEtat(
      analyse.ok
        ? { etape: 'resultat', adresse, analyse: analyse.valeur }
        : { etape: 'erreur', message: PHRASES_ADRESSE.indisponible },
    );
  };

  const chercher = async (): Promise<void> => {
    setEtat({ etape: 'recherche' });
    const lieu = await client.geocoder(texte.trim());
    if (!lieu.ok) {
      setEtat({ etape: 'erreur', message: PHRASES_ADRESSE.indisponible });
      return;
    }
    const trouve = lieu.valeur;
    if (trouve?.codeInsee == null) {
      setEtat({ etape: 'erreur', message: PHRASES_ADRESSE.introuvable });
      return;
    }
    const imprecision = phrasePrecision(trouve.precision);
    if (imprecision !== null) {
      setEtat({ etape: 'erreur', message: imprecision });
      return;
    }
    const voie = lireCleBan(trouve.cleBan);
    const adresse: AdresseBien = {
      libelle: trouve.libelle,
      lat: trouve.lat,
      lon: trouve.lon,
      codeInsee: trouve.codeInsee,
      codeVoie: voie?.codeVoie ?? null,
      numero: voie?.numero ?? null,
    };
    setTexte(adresse.libelle);
    mettreAJour(enregistre.id, projet, { adresse });
    await analyser(adresse);
  };

  // Une adresse déjà enregistrée est réanalysée une seule fois, à l'ouverture de l'onglet (réponse en cache 24 h).
  const adresseEnregistree = enregistre.adresse;
  useEffect(() => {
    if (adresseEnregistree !== undefined) void analyser(adresseEnregistree);
  }, []);

  const prixM2Bien = projet.hypotheses.achat.prix / projet.bien.surface;
  const reference = etat.etape === 'resultat' ? etat.analyse.reference : null;
  const repereUtilise =
    reference !== null &&
    projet.marche.dvf?.medianM2 === reference.statistiques.medianeM2 &&
    projet.marche.dvf.rayonMetres === reference.rayonMetres;

  const utiliserRepere = (): void => {
    if (etat.etape !== 'resultat' || reference === null) return;
    const repere = marcheDepuisReference(
      reference,
      etat.analyse.tendance?.periodeReference ?? null,
    );
    mettreAJour(
      enregistre.id,
      {
        ...projet,
        marche: { ...projet.marche, dvf: repere.dvf },
        provenance: { ...projet.provenance, ...repere.provenance },
      },
      { adresse: etat.adresse },
    );
  };

  return (
    <div className="flex flex-col gap-5 px-10 pt-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 max-w-[26ch] font-display text-[36px] leading-[1.1] font-bold tracking-tight">
          Combien vaut ce bien, à l'adresse exacte ?
        </h1>
        <p className="m-0 max-w-[64ch] text-[17px] text-encre-2">
          Les ventes réelles au plus près du bien, ramenées au prix d'aujourd'hui, puis corrigées
          selon son état et ses caractéristiques. Chaque chiffre montre sa source.
        </p>
      </div>

      <Carte>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void chercher();
          }}
        >
          <label className="flex min-w-[320px] flex-1 flex-col gap-2">
            <span className="text-sm font-semibold text-encre-2">Adresse du bien</span>
            <input
              name="adresse"
              value={texte}
              placeholder="144 rue de l'Olivier 13005 Marseille"
              onChange={(e) => {
                setTexte(e.target.value);
              }}
              className="min-h-[52px] rounded-encart border border-bordure bg-surface px-4 text-[16px]"
            />
          </label>
          <Bouton
            variante="primaire"
            type="submit"
            disabled={texte.trim() === '' || etat.etape === 'recherche'}
          >
            {etat.etape === 'recherche' ? 'Analyse en cours…' : 'Analyser'}
          </Bouton>
        </form>
        {etat.etape === 'erreur' && (
          <Pastille ton="surveiller" compacte>
            {etat.message}
          </Pastille>
        )}
      </Carte>

      {etat.etape === 'resultat' && (
        <Carte>
          <h2 className="m-0 font-display text-[22px] font-semibold">Le repère de prix</h2>
          <p className="m-0 text-[17px]">
            {reference !== null
              ? phraseReference(
                  reference,
                  ecartAuRepere(prixM2Bien, reference.statistiques.medianeM2),
                )
              : etat.analyse.ventesCommune === 0
                ? PHRASES_ADRESSE.sansVentes
                : PHRASES_ADRESSE.sansRepere}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {reference !== null &&
              (repereUtilise ? (
                <Pastille ton="bon" compacte>
                  {PHRASES_ADRESSE.repereUtilise}
                </Pastille>
              ) : (
                <Bouton variante="primaire" onClick={utiliserRepere}>
                  Utiliser ce repère pour l'estimation
                </Bouton>
              ))}
            {etat.analyse.cadastre === 'indisponible' && (
              <Pastille ton="surveiller" compacte>
                {PHRASES_ADRESSE.cadastreIndisponible}
              </Pastille>
            )}
          </div>
        </Carte>
      )}

      <CarteEstimation />

      {etat.etape === 'resultat' && (
        <>
          {etat.analyse.tendance != null && <Tendance tendance={etat.analyse.tendance} />}
          <TableauGroupes analyse={etat.analyse} />
          <TableauVentes analyse={etat.analyse} />
          <p className="m-0 text-xs text-encre-3">
            Sources : {etat.analyse.sources.map((s) => s.nom).join(' ; ')}
            {etat.analyse.parcelle === null ? '' : ` · parcelle ${etat.analyse.parcelle}`}.
          </p>
        </>
      )}
    </div>
  );
}
