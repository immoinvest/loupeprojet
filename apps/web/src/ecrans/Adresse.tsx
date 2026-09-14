import { obtenirRegles } from '@loupe/moteur';
import { useEffect, useState, type JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useClientWorker } from '@/coque/ClientWorker';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  appliquerLoyerReference,
  appliquerRisques,
  ecartAuRepere,
  lireCleBan,
  loyerPourBien,
  marcheDepuisReference,
  memesRisques,
  risquesDuProjet,
  type DpeAdresse,
  type ReponseAdresse,
  type ReponseMarche,
  type ReponseRisques,
  type Resultat,
} from '@/enrichissement';
import { useProjets } from '@/stockage/ProjetsContext';
import type { AdresseBien } from '@/stockage/projets';
import { PHRASES_ADRESSE, phrasePrecision, phraseReference } from '@/textes/adresse';

import { CarteDpe } from './adresse/Dpe';
import { CarteEstimation } from './adresse/Estimation';
import { CarteLoyer } from './adresse/Loyer';
import { CarteRisques } from './adresse/Risques';
import { TableauGroupes, TableauVentes } from './adresse/Tableaux';
import { Tendance } from './adresse/Tendance';

interface DonneesAdresse {
  readonly analyse: ReponseAdresse;
  readonly dpe: Resultat<readonly DpeAdresse[]>;
  readonly risques: Resultat<ReponseRisques>;
  readonly marche: Resultat<ReponseMarche>;
}

type Etat =
  | { readonly etape: 'saisie' }
  | { readonly etape: 'recherche' }
  | { readonly etape: 'erreur'; readonly message: string }
  | { readonly etape: 'resultat'; readonly adresse: AdresseBien; readonly donnees: DonneesAdresse };

const SANS_CODE_POSTAL: Resultat<ReponseMarche> = { ok: false, code: 'SANS_CODE_POSTAL' };

export function Adresse(): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const client = useClientWorker();
  const [texte, setTexte] = useState(enregistre.adresse?.libelle ?? '');
  const [etat, setEtat] = useState<Etat>({ etape: 'saisie' });
  const { projet } = enregistre;

  /** Ventes, DPE, risques et loyer en parallèle ; risques et loyer de référence s'appliquent d'eux-mêmes. */
  const analyser = async (adresse: AdresseBien): Promise<void> => {
    setEtat({ etape: 'recherche' });
    const position = { lat: adresse.lat, lon: adresse.lon };
    const [analyse, dpe, risques, marche] = await Promise.all([
      client.analyserAdresse({
        codeInsee: adresse.codeInsee,
        lat: adresse.lat,
        lon: adresse.lon,
        numero: adresse.numero,
        codeVoie: adresse.codeVoie,
        type: projet.bien.type,
        surface: projet.bien.surface,
      }),
      client.dpe(position),
      client.risques(position),
      adresse.codePostal === undefined
        ? Promise.resolve(SANS_CODE_POSTAL)
        : client.marche({
            codeInsee: adresse.codeInsee,
            codePostal: adresse.codePostal,
            type: projet.bien.type,
            pieces: projet.bien.pieces,
          }),
    ]);
    if (!analyse.ok) {
      setEtat({ etape: 'erreur', message: PHRASES_ADRESSE.indisponible });
      return;
    }
    let suivant = projet;
    if (risques.ok) {
      const nouveaux = risquesDuProjet(risques.valeur);
      if (!memesRisques(projet.marche.risques, nouveaux)) {
        suivant = appliquerRisques(suivant, nouveaux);
      }
    }
    if (marche.ok && marche.valeur.loyer !== null) {
      const prime = obtenirRegles(projet.versionRegles).exploitation.primeMeuble;
      const loyer = loyerPourBien(marche.valeur.loyer, projet.bien.surface, prime);
      if (projet.marche.loyerReferenceM2 !== loyer.referenceM2) {
        suivant = appliquerLoyerReference(suivant, loyer);
      }
    }
    if (suivant !== projet) mettreAJour(enregistre.id, suivant, { adresse });
    setEtat({
      etape: 'resultat',
      adresse,
      donnees: { analyse: analyse.valeur, dpe, risques, marche },
    });
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
      ...(trouve.codePostal === null ? {} : { codePostal: trouve.codePostal }),
    };
    setTexte(adresse.libelle);
    mettreAJour(enregistre.id, projet, { adresse });
    await analyser(adresse);
  };

  // Une adresse déjà enregistrée est réanalysée une seule fois, à l'ouverture de l'onglet : c'est
  // l'actualisation du projet (ventes, tendance, DPE, risques, loyer ; réponses en cache côté Worker).
  const adresseEnregistree = enregistre.adresse;
  useEffect(() => {
    if (adresseEnregistree !== undefined) void analyser(adresseEnregistree);
  }, []);

  const prixM2Bien = projet.hypotheses.achat.prix / projet.bien.surface;
  const analyse = etat.etape === 'resultat' ? etat.donnees.analyse : null;
  const reference = analyse?.reference ?? null;
  const repereUtilise =
    reference !== null &&
    projet.marche.dvf?.medianM2 === reference.statistiques.medianeM2 &&
    projet.marche.dvf.rayonMetres === reference.rayonMetres;

  const utiliserRepere = (): void => {
    if (etat.etape !== 'resultat' || reference === null) return;
    const repere = marcheDepuisReference(
      reference,
      etat.donnees.analyse.tendance?.periodeReference ?? null,
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
          selon son état et ses caractéristiques. Le DPE, les risques et le loyer de marché de
          l'adresse s'y ajoutent. Chaque chiffre montre sa source.
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

      {etat.etape === 'resultat' && analyse !== null && (
        <Carte>
          <h2 className="m-0 font-display text-[22px] font-semibold">Le repère de prix</h2>
          <p className="m-0 text-[17px]">
            {reference !== null
              ? phraseReference(
                  reference,
                  ecartAuRepere(prixM2Bien, reference.statistiques.medianeM2),
                )
              : analyse.ventesCommune === 0
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
            {analyse.cadastre === 'indisponible' && (
              <Pastille ton="surveiller" compacte>
                {PHRASES_ADRESSE.cadastreIndisponible}
              </Pastille>
            )}
          </div>
        </Carte>
      )}

      <CarteEstimation />

      {etat.etape === 'resultat' && analyse !== null && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <CarteDpe resultat={etat.donnees.dpe} adresse={etat.adresse} />
            <CarteLoyer resultat={etat.donnees.marche} />
          </div>
          <CarteRisques resultat={etat.donnees.risques} />
          {analyse.tendance != null && <Tendance tendance={analyse.tendance} />}
          <TableauGroupes analyse={analyse} />
          <TableauVentes analyse={analyse} />
          <p className="m-0 text-xs text-encre-3">
            Sources : {analyse.sources.map((s) => s.nom).join(' ; ')}
            {analyse.parcelle === null ? '' : ` · parcelle ${analyse.parcelle}`}
            {(analyse.communesVoisines ?? []).length === 0
              ? ''
              : ` · ventes des communes voisines comprises (${(analyse.communesVoisines ?? []).map((c) => c.codeInsee).join(', ')})`}
            .
          </p>
        </>
      )}
    </div>
  );
}
