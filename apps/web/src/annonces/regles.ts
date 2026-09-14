import { creerRegistre, type Registre } from '@loupe/capture';
import bienici from '@loupe/extension/regles/bienici.json';
import leboncoin from '@loupe/extension/regles/leboncoin.json';
import logicimmo from '@loupe/extension/regles/logicimmo.json';
import pap from '@loupe/extension/regles/pap.json';
import seloger from '@loupe/extension/regles/seloger.json';

/**
 * Les mêmes règles que l'extension, figées au build du web : le bouton-favori les applique sur le
 * portail, la lecture par le serveur les applique à la page que le Worker rapporte.
 */
export const REGISTRE_WEB: Registre = creerRegistre([leboncoin, seloger, bienici, pap, logicimmo]);
