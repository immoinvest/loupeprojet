import { creerRegistre, type Registre } from '@loupe/capture';

import bienici from '../regles/bienici.json';
import leboncoin from '../regles/leboncoin.json';
import logicimmo from '../regles/logicimmo.json';
import pap from '../regles/pap.json';
import seloger from '../regles/seloger.json';

/**
 * Les règles de capture embarquées dans cette version de l'extension, validées au chargement.
 * Un jour, ce registre pourra être rafraîchi depuis R2 sans republier l'extension : c'est le
 * seul point d'entrée vers les règles.
 */
export const REGISTRE: Registre = creerRegistre([leboncoin, seloger, bienici, pap, logicimmo]);
