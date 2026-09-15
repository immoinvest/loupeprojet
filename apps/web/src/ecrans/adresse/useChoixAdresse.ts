import { useState } from 'react';

import {
  adresseDeRue,
  adresseDepuisCadastre,
  adresseDepuisSuggestion,
  demandeNumero,
  estNumeroFiscal,
  lireCleBan,
  numeroTape,
  type ClientWorker,
  type OptionAdresse,
  type ResultatGeocodage,
  type SuggestionAdresse,
} from '@/enrichissement';
import type { AdresseBien } from '@/stockage/projets';
import { PHRASES_ADRESSE, phrasePrecision } from '@/textes/adresse';

export interface ReglagesChoix {
  readonly client: ClientWorker;
  /** Enregistre l'adresse, l'affiche dans le champ et lance l'analyse. */
  readonly retenir: (adresse: AdresseBien) => Promise<void>;
  readonly erreur: (message: string) => void;
  /** Une recherche commence (géocodage). */
  readonly patienter: () => void;
  readonly montrerTexte: (texte: string) => void;
  /** L'adresse déjà enregistrée du projet : « Analyser » la reprend telle quelle si le champ la montre. */
  readonly adresseConnue?: AdresseBien | undefined;
}

export interface ChoixAdresse {
  /** La rue choisie qui attend son numéro. */
  readonly rue: SuggestionAdresse | null;
  /** Ce qui distingue l'analyse en cours : adresse du cadastre, analyse sans numéro. */
  readonly note: string | null;
  /** Bouton « Analyser » : géocodage du texte tapé, premier résultat. */
  readonly chercher: (texte: string) => Promise<void>;
  readonly choisir: (option: OptionAdresse) => void;
  /** Numéro donné pour la rue en attente, ou `null` : « Je ne connais pas le numéro ». */
  readonly numeroDeRue: (numero: number | null) => Promise<void>;
  readonly oublierRue: () => void;
}

/** Un résultat de géocodage avec commune devient l'adresse analysée ; `numero` sert quand la clé BAN n'en a pas. */
function adresseDeGeocodage(
  trouve: ResultatGeocodage & { readonly codeInsee: string },
  numero: number | null,
): AdresseBien {
  const voie = lireCleBan(trouve.cleBan);
  return {
    libelle: trouve.libelle,
    lat: trouve.lat,
    lon: trouve.lon,
    codeInsee: trouve.codeInsee,
    codeVoie: voie?.codeVoie ?? null,
    numero: voie?.numero ?? numero,
    ...(trouve.codePostal === null ? {} : { codePostal: trouve.codePostal }),
  };
}

const aUneCommune = (
  trouve: ResultatGeocodage | null,
): trouve is ResultatGeocodage & { readonly codeInsee: string } => trouve?.codeInsee != null;

/**
 * Le choix de l'adresse de l'onglet Estimation : suggestion (analyse immédiate), rue sans numéro (« Numéro ? »),
 * adresse du cadastre, ou saisie libre et bouton « Analyser ».
 */
export function useChoixAdresse({
  client,
  retenir,
  erreur,
  patienter,
  montrerTexte,
  adresseConnue,
}: ReglagesChoix): ChoixAdresse {
  const [rue, setRue] = useState<SuggestionAdresse | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** La dernière adresse analysée (suggestion, cadastre, rue avec ou sans numéro), sinon celle du projet. */
  const [retenue, setRetenue] = useState<AdresseBien | null>(adresseConnue ?? null);

  const analyser = async (adresse: AdresseBien, remarque: string | null): Promise<void> => {
    setRue(null);
    setNote(remarque);
    setRetenue(adresse);
    await retenir(adresse);
  };

  const chercher = async (texte: string): Promise<void> => {
    // Le champ montre l'adresse déjà choisie : on la réanalyse. La géocoder à nouveau perdrait une adresse du
    // cadastre (9001 Res Galice…), que la BAN ne connaît pas.
    if (retenue !== null && texte.trim() === retenue.libelle.trim()) {
      setRue(null);
      await retenir(retenue);
      return;
    }
    setRue(null);
    setNote(null);
    patienter();
    const lieu = await client.geocoder(texte.trim());
    if (!lieu.ok) {
      erreur(PHRASES_ADRESSE.indisponible);
      return;
    }
    const trouve = lieu.valeur;
    if (!aUneCommune(trouve)) {
      erreur(PHRASES_ADRESSE.introuvable);
      return;
    }
    const imprecision = phrasePrecision(trouve.precision);
    if (imprecision !== null) {
      // Un numéro fiscal (9001…) n'existe pas dans la BAN : il se choisit parmi les adresses du cadastre.
      erreur(
        trouve.precision === 'rue' && estNumeroFiscal(numeroTape(texte))
          ? PHRASES_ADRESSE.numeroCadastre
          : imprecision,
      );
      return;
    }
    await analyser(adresseDeGeocodage(trouve, null), null);
  };

  const choisir = (option: OptionAdresse): void => {
    if (option.source === 'cadastre') {
      void analyser(
        adresseDepuisCadastre(option.adresse, option.lieu),
        PHRASES_ADRESSE.adresseCadastre,
      );
      return;
    }
    if (demandeNumero(option)) {
      montrerTexte(option.suggestion.libelle);
      setNote(null);
      setRue(option.suggestion);
      return;
    }
    const adresse = adresseDepuisSuggestion(option.suggestion);
    if (adresse === null) {
      erreur(PHRASES_ADRESSE.introuvable);
      return;
    }
    void analyser(adresse, null);
  };

  const numeroDeRue = async (numero: number | null): Promise<void> => {
    if (rue === null) return;
    if (numero === null) {
      const sansNumero = adresseDeRue(rue, null);
      if (sansNumero !== null) await analyser(sansNumero, PHRASES_ADRESSE.sansNumero);
      return;
    }
    patienter();
    const precis = await client.geocoder(`${String(numero)} ${rue.libelle}`);
    const trouve = precis.ok ? precis.valeur : null;
    if (aUneCommune(trouve) && trouve.precision === 'adresse') {
      await analyser(adresseDeGeocodage(trouve, numero), null);
      return;
    }
    if (estNumeroFiscal(numero)) {
      erreur(PHRASES_ADRESSE.numeroCadastre);
      return;
    }
    // La BAN ne connaît pas ce numéro : le point de la rue, avec le numéro pour « même côté » et « en face ».
    const auPointDeLaRue = adresseDeRue(rue, numero);
    if (auPointDeLaRue !== null) await analyser(auPointDeLaRue, null);
  };

  return {
    rue,
    note,
    chercher,
    choisir,
    numeroDeRue,
    oublierRue: () => {
      setRue(null);
    },
  };
}
