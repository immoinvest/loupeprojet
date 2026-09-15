import { describe, expect, it } from 'vitest';

import { envoyeurJournal, envoyeurResend, ErreurCourriel, URL_RESEND } from '../src/courriel';
import { journalMemoire } from '../src/journal';

const MESSAGE = { a: 'julie@exemple.fr', sujet: 'Sujet', texte: 'Texte', html: '<p>Texte</p>' };

describe('envoyeur partagé', () => {
  it('Resend : pièces jointes et adresse de réponse transmises', async () => {
    const appels: { url: string; corps: unknown }[] = [];
    const envoyeur = envoyeurResend('cle', 'Deklic <envoi@deklic.pro>', (url, init) => {
      appels.push({ url, corps: JSON.parse(init.body as string) });
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    await envoyeur.envoyer({
      ...MESSAGE,
      repondreA: 'pierre@exemple.fr',
      pieces: [{ nom: 'quittance.pdf', type: 'application/pdf', base64: 'JVBERi0=' }],
    });
    expect(envoyeur.mode).toBeUndefined();
    expect(appels).toEqual([
      {
        url: URL_RESEND,
        corps: {
          from: 'Deklic <envoi@deklic.pro>',
          to: ['julie@exemple.fr'],
          subject: 'Sujet',
          text: 'Texte',
          html: '<p>Texte</p>',
          reply_to: 'pierre@exemple.fr',
          attachments: [
            { filename: 'quittance.pdf', content: 'JVBERi0=', content_type: 'application/pdf' },
          ],
        },
      },
    ]);
  });

  it('Resend : un refus garde le statut, une panne réseau vaut 0', async () => {
    const refus = envoyeurResend('cle', 'x', () =>
      Promise.resolve(new Response('', { status: 422 })),
    );
    await expect(refus.envoyer(MESSAGE)).rejects.toMatchObject({
      name: 'ErreurCourriel',
      statut: 422,
    });
    const panne = envoyeurResend('cle', 'x', () => Promise.reject(new Error('réseau')));
    const erreur: unknown = await panne.envoyer(MESSAGE).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurCourriel);
    expect((erreur as ErreurCourriel).statut).toBe(0);
  });

  it('journal : mode affiché, ni destinataire ni pièce jointe dans le journal', async () => {
    const journal = journalMemoire();
    const envoyeur = envoyeurJournal(journal);
    expect(envoyeur.mode).toBe('journal');
    await envoyeur.envoyer({
      ...MESSAGE,
      pieces: [{ nom: 'q.pdf', type: 'application/pdf', base64: 'AAAA' }],
    });
    expect(JSON.stringify(journal.evenements)).not.toContain('julie@exemple.fr');
    expect(journal.evenements[0]?.donnees).toEqual({ sujet: 'Sujet', texte: 'Texte', pieces: 1 });
  });
});
