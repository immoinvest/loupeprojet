import { obtenirRegles, prixRetenu } from '@loupe/moteur';
import { useEffect, useId, useState, type JSX } from 'react';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { ChampAdresse } from '@/composants/saisie/ChampAdresse';
import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useClientWorker } from '@/coque/ClientWorker';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  appliquerLoyerReference,
  appliquerRepere,
  appliquerRisques,
  decisionRepere,
  instantaneRepere,
  loyerPourBien,
  marcheDepuisReference,
  memesRisques,
  restaurerRepere,
  risquesDuProjet,
  type DpeAdresse,
  type InstantaneRepere,
  type ReponseAdresse,
  type ReponseMarche,
  type ReponseRisques,
  type Resultat,
} from '@/enrichissement';
import { useProjets } from '@/stockage/ProjetsContext';
import type { AdresseBien } from '@/stockage/projets';
import { PHRASES_ADRESSE } from '@/textes/adresse';

import { BlocRepere } from './adresse/BlocRepere';
import { CarteQuartier } from './adresse/CarteQuartier';
import { CarteConfiance } from './adresse/Confiance';
import { CarteDpe } from './adresse/Dpe';
import { CarteEstimation } from './adresse/Estimation';
import { LigneAdresse } from './adresse/LigneAdresse';
import type { EtatLigneRepere } from './adresse/LigneRepere';
import { CarteLoyer } from './adresse/Loyer';
import { NumeroRue } from './adresse/NumeroRue';
import { RepereAnalyse } from './adresse/RepereAnalyse';
import { CarteRisques } from './adresse/Risques';
import { TableauGroupes, TableauVentes } from './adresse/Tableaux';
import { Tendance } from './adresse/Tendance';
import { useChoixAdresse } from './adresse/useChoixAdresse';

interface DonneesAdresse {
  readonly analyse: ReponseAdresse;
  readonly dpe: Resultat<readonly DpeAdresse[]>;
  readonly risques: Resultat<ReponseRisques>;
  readonly marche: Resultat<ReponseMarche>;
}

/** Ce qu'est devenu le repère de l'adresse ; `precedent` permet « Annuler » (gardé par l'écran, pas par le projet). */
interface SuiviRepere {
  readonly etat: EtatLigneRepere;
  readonly precedent: InstantaneRepere | null;
}

type Etat =
  | { readonly etape: 'saisie' }
  | { readonly etape: 'recherche' }
  | { readonly etape: 'erreur'; readonly message: string }
  | {
      readonly etape: 'resultat';
      readonly adresse: AdresseBien;
      readonly donnees: DonneesAdresse;
      readonly repere: SuiviRepere | null;
    };

const SANS_CODE_POSTAL: Resultat<ReponseMarche> = { ok: false, code: 'SANS_CODE_POSTAL' };

export function Adresse(): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const client = useClientWorker();
  const idAdresse = useId();
  const [texte, setTexte] = useState(enregistre.adresse?.libelle ?? '');
  const [etat, setEtat] = useState<Etat>({ etape: 'saisie' });
  // Sans adresse enregistrée, la carte de l'adresse vient en premier ; avec une adresse, une ligne compacte
  // la remplace jusqu'à « Changer » (fiche 14).
  const [formulaireOuvert, setFormulaireOuvert] = useState(enregistre.adresse === undefined);
  const { projet } = enregistre;

  /**
   * Ventes, DPE, risques et loyer en parallèle ; risques, loyer de référence et repère de prix de l'adresse
   * s'appliquent d'eux-mêmes, en une seule écriture. Un repère saisi à la main n'est jamais remplacé.
   */
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
    let repere: SuiviRepere | null = null;
    const reference = analyse.valeur.reference;
    if (reference !== null) {
      const marcheAdresse = marcheDepuisReference(
        reference,
        analyse.valeur.tendance?.periodeReference ?? null,
      );
      const decision = decisionRepere(suivant, marcheAdresse);
      if (decision === 'appliquer') {
        repere = { etat: 'applique', precedent: instantaneRepere(suivant) };
        suivant = appliquerRepere(suivant, marcheAdresse);
      } else {
        repere = { etat: decision === 'deja' ? 'deja' : 'protege', precedent: null };
      }
    }
    if (suivant !== projet) mettreAJour(enregistre.id, suivant, { adresse });
    setEtat({
      etape: 'resultat',
      adresse,
      donnees: { analyse: analyse.valeur, dpe, risques, marche },
      repere,
    });
  };

  const choix = useChoixAdresse({
    client,
    retenir: async (adresse) => {
      setTexte(adresse.libelle);
      mettreAJour(enregistre.id, projet, { adresse });
      await analyser(adresse);
    },
    erreur: (message) => {
      setEtat({ etape: 'erreur', message });
    },
    patienter: () => {
      setEtat({ etape: 'recherche' });
    },
    montrerTexte: setTexte,
  });

  // Une adresse déjà enregistrée est réanalysée une seule fois, à l'ouverture de l'onglet : c'est
  // l'actualisation du projet (ventes, tendance, DPE, risques, loyer, repère ; réponses en cache côté Worker).
  const adresseEnregistree = enregistre.adresse;
  useEffect(() => {
    if (adresseEnregistree !== undefined) void analyser(adresseEnregistree);
  }, []);

  const prixM2Bien = prixRetenu(projet.hypotheses.achat) / projet.bien.surface;
  const analyse = etat.etape === 'resultat' ? etat.donnees.analyse : null;

  const carteAdresse = (
    <Carte>
      <h2 className="m-0 font-display text-[22px] font-semibold">{PHRASES_ADRESSE.titreAdresse}</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void choix.chercher(texte);
        }}
      >
        {/* Toute la largeur sur téléphone ; à partir de 640 px, le champ et le bouton côte à côte. */}
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:min-w-[320px] sm:flex-1">
          <label htmlFor={idAdresse} className="text-sm font-semibold text-encre-2">
            {PHRASES_ADRESSE.adresseDuBien}
          </label>
          <ChampAdresse
            id={idAdresse}
            texte={texte}
            onTexte={(saisi) => {
              setTexte(saisi);
              choix.oublierRue();
            }}
            contexte={{ departement: projet.bien.departement, adresse: enregistre.adresse }}
            onChoix={choix.choisir}
          />
        </div>
        <Bouton
          variante="primaire"
          type="submit"
          disabled={texte.trim() === '' || etat.etape === 'recherche'}
        >
          {etat.etape === 'recherche' ? PHRASES_ADRESSE.analyseEnCours : 'Analyser'}
        </Bouton>
      </form>
      {choix.rue !== null && (
        <NumeroRue
          libelle={choix.rue.libelle}
          occupe={etat.etape === 'recherche'}
          onNumero={(numero) => {
            void choix.numeroDeRue(numero);
          }}
        />
      )}
      {etat.etape === 'erreur' && (
        <Pastille ton="surveiller" compacte>
          {etat.message}
        </Pastille>
      )}
      {etat.etape === 'resultat' && choix.note !== null && (
        <Pastille ton="accent" compacte>
          {choix.note}
        </Pastille>
      )}
    </Carte>
  );

  return (
    <Page>
      <TitrePage taille="volet" className="max-w-[26ch]">
        Combien vaut ce bien, à l'adresse exacte ?
      </TitrePage>

      {formulaireOuvert || enregistre.adresse === undefined ? (
        carteAdresse
      ) : (
        <LigneAdresse
          libelle={enregistre.adresse.libelle}
          enCours={etat.etape === 'recherche'}
          erreur={etat.etape === 'erreur' ? etat.message : null}
          onChanger={() => {
            setFormulaireOuvert(true);
          }}
        />
      )}

      <CarteConfiance />

      <CarteEstimation
        repere={
          etat.etape === 'resultat' && analyse !== null ? (
            <RepereAnalyse
              analyse={analyse}
              etat={etat.repere?.etat ?? null}
              prixM2Bien={prixM2Bien}
              onAnnuler={() => {
                // « Annuler » : remet le repère d'avant l'analyse.
                const precedent = etat.repere?.precedent;
                if (precedent == null) return;
                mettreAJour(enregistre.id, restaurerRepere(projet, precedent), {
                  adresse: etat.adresse,
                });
                setEtat({ ...etat, repere: { etat: 'annule', precedent: null } });
              }}
              onAppliquer={(reference) => {
                // « Appliquer » après une annulation, ou « Remplacer » un repère saisi à la main.
                const precedent = instantaneRepere(projet);
                const marcheAdresse = marcheDepuisReference(
                  reference,
                  analyse.tendance?.periodeReference ?? null,
                );
                mettreAJour(enregistre.id, appliquerRepere(projet, marcheAdresse), {
                  adresse: etat.adresse,
                });
                setEtat({ ...etat, repere: { etat: 'applique', precedent } });
              }}
            />
          ) : (
            <BlocRepere />
          )
        }
      />

      {etat.etape === 'resultat' && analyse !== null && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <CarteDpe resultat={etat.donnees.dpe} adresse={etat.adresse} />
            <CarteLoyer resultat={etat.donnees.marche} />
          </div>
          <CarteRisques resultat={etat.donnees.risques} />
          <CarteQuartier analyse={analyse} adresse={etat.adresse} />
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
    </Page>
  );
}
