import { describe, expect, it } from 'vitest';

import { deMois, nomsDesLocataires } from '../src/courriels/format';
import {
  echapperHtml,
  messageInvitation,
  messageQuittance,
  nomFichierQuittance,
} from '../src/courriels/gabarits';
import { QUITTANCE } from './exemples-envois';

describe('gabarits des e-mails au locataire (instantanés)', () => {
  it('invitation : vouvoiement, bailleur, logement, bouton, validité et article 21', () => {
    const message = messageInvitation({
      prenom: 'Julie',
      bailleur: 'Pierre Georgel',
      logement: 'T2 Lices, 12 rue des Lices',
      lien: 'https://loupeprojet.pages.dev/accord#abc.123.sig',
    });
    expect(message.sujet).toBe('Vos quittances de loyer par e-mail');
    expect(message.texte).toContain('https://loupeprojet.pages.dev/accord#abc.123.sig');
    expect(message.html).toContain('Oui, recevoir mes quittances par e-mail');
    expect(message).toMatchSnapshot();
  });

  it('invitation sans bailleur ni logement connus', () => {
    const message = messageInvitation({
      prenom: 'Julie',
      bailleur: null,
      logement: null,
      lien: 'https://app.deklic.pro/accord#j',
    });
    expect(message.texte).toContain(
      'Votre bailleur vous propose de recevoir vos quittances de loyer par e-mail.',
    );
  });

  it('quittance : sujet du mois, montant, logement, numéro', () => {
    const message = messageQuittance('Julie', QUITTANCE);
    expect(message.sujet).toBe('Votre quittance de loyer – octobre 2026');
    expect(message.texte).toContain('la quittance de loyer d’octobre 2026');
    expect(nomFichierQuittance(QUITTANCE)).toBe('quittance-2026-10-Q-202610-L1.pdf');
    expect(message).toMatchSnapshot();
  });

  it('toute donnée saisie est échappée dans le HTML', () => {
    const message = messageInvitation({
      prenom: '<script>alert(1)</script>',
      bailleur: 'A & "B"',
      logement: "l'<b>",
      lien: 'https://app.deklic.pro/accord#"><img>',
    });
    expect(message.html).not.toContain('<script>');
    expect(message.html).not.toContain('<img>');
    expect(message.html).toContain('A &amp; &quot;B&quot;');
    expect(echapperHtml("'")).toBe('&#39;');
    const quittance = messageQuittance('<i>', {
      ...QUITTANCE,
      bailleur: { nom: '<b>SCI</b>', adresse: 'x' },
    });
    expect(quittance.html).not.toContain('<b>SCI');
    expect(quittance.html).not.toContain('<i>');
  });
});

describe('format', () => {
  it('« de » ou « d’ » devant le mois ; noms reliés par « et »', () => {
    expect(deMois('2026-09')).toBe('de septembre 2026');
    expect(deMois('2026-04')).toBe('d’avril 2026');
    expect(nomsDesLocataires([])).toBe('');
    expect(nomsDesLocataires(['A'])).toBe('A');
    expect(nomsDesLocataires(['A', 'B', 'C'])).toBe('A, B et C');
  });
});
