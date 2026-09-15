import { describe, expect, it } from 'vitest';

import {
  accordValide,
  BailleurBienSchema,
  ContactLocataireSchema,
  destinatairesQuittance,
  EtatEnvoisSchema,
  expirationJeton,
  invitationPossible,
  JetonAccordSchema,
  locatairesAVerifier,
  masquerEmail,
  normaliserEmail,
  renvoiPossible,
  ReponseAccordSchema,
  statutAccord,
  type Envoi,
  type StatutAccordEffectif,
} from '../src';

const EMPREINTE_A = 'a'.repeat(64);
const EMPREINTE_B = 'b'.repeat(64);

describe('statut de l’accord (ADR-G42)', () => {
  it('sans e-mail, jamais demandé, demandé pour une autre adresse, ou enregistré', () => {
    expect(statutAccord(undefined, undefined)).toBe('sans_email');
    expect(statutAccord({ statut: 'accorde', emailEmpreinte: EMPREINTE_A }, undefined)).toBe(
      'sans_email',
    );
    expect(statutAccord(undefined, EMPREINTE_A)).toBe('non_demande');
    expect(statutAccord({ statut: 'accorde', emailEmpreinte: EMPREINTE_B }, EMPREINTE_A)).toBe(
      'non_demande',
    );
    expect(statutAccord({ statut: 'refuse', emailEmpreinte: EMPREINTE_A }, EMPREINTE_A)).toBe(
      'refuse',
    );
  });

  it('seuls l’accord par le lien et la déclaration du bailleur permettent l’envoi', () => {
    const valides = (
      [
        'sans_email',
        'non_demande',
        'en_attente',
        'accorde',
        'refuse',
        'declare_par_bailleur',
      ] as const
    ).filter(accordValide);
    expect(valides).toEqual(['accorde', 'declare_par_bailleur']);
  });
});

describe('adresses', () => {
  it('normalise et masque', () => {
    expect(normaliserEmail('  Julie.Martin@Exemple.FR ')).toBe('julie.martin@exemple.fr');
    expect(masquerEmail('julie@exemple.fr')).toBe('julie@…');
    expect(masquerEmail('a@b@c.fr')).toBe('a@b@…');
    expect(masquerEmail('sans-arobase')).toBe('…');
    expect(masquerEmail('@exemple.fr')).toBe('…');
  });
});

describe('destinataires d’une quittance', () => {
  it('le locataire en titre puis les colocataires, avec e-mail et accord valide', () => {
    const statuts = new Map<string, StatutAccordEffectif>([
      ['julie', 'accorde'],
      ['lea', 'declare_par_bailleur'],
      ['marc', 'en_attente'],
    ]);
    const locataires = [
      { id: 'lea', email: 'lea@exemple.fr' },
      { id: 'julie', email: 'julie@exemple.fr' },
      { id: 'marc', email: 'marc@exemple.fr' },
      { id: 'sans', email: undefined },
    ];
    expect(
      destinatairesQuittance(
        { locataireId: 'julie', colocataireIds: ['lea', 'marc', 'sans', 'inconnu', 'absent'] },
        locataires,
        statuts,
      ),
    ).toEqual([
      { locataireId: 'julie', email: 'julie@exemple.fr' },
      { locataireId: 'lea', email: 'lea@exemple.fr' },
    ]);
  });
});

describe('délais', () => {
  const H = '2026-10-06T08:00:00.000Z';

  it('invitation : une par 24 h', () => {
    expect(invitationPossible(undefined, H)).toBe(true);
    expect(invitationPossible('2026-10-05T08:00:01.000Z', H)).toBe(false);
    expect(invitationPossible('2026-10-05T08:00:00.000Z', H)).toBe(true);
  });

  it('renvoi : un par minute', () => {
    expect(renvoiPossible('2026-10-06T07:59:30.000Z', H)).toBe(false);
    expect(renvoiPossible('2026-10-06T07:59:00.000Z', H)).toBe(true);
  });

  it('un lien d’accord vaut 30 jours', () => {
    expect(expirationJeton(H)).toBe('2026-11-05T08:00:00.000Z');
  });
});

describe('adresses à vérifier', () => {
  const envoi = (locataireId: string, statut: Envoi['statut'], le: string): Envoi => ({
    id: `${locataireId}-${le}`,
    documentId: 'd',
    locataireId,
    destinataire: 'x@…',
    statut,
    tentatives: 2,
    dernierEssaiLe: le,
  });

  it('seul le dernier envoi de chaque locataire compte', () => {
    expect(
      locatairesAVerifier([
        envoi('julie', 'echec', '2026-10-06'),
        envoi('julie', 'envoye', '2026-11-06'),
        envoi('lea', 'envoye', '2026-10-06'),
        envoi('lea', 'echec', '2026-11-06'),
        envoi('marc', 'echec', '2026-11-06'),
        envoi('marc', 'envoye', '2026-10-06'),
      ]),
    ).toEqual(['lea', 'marc']);
  });
});

describe('schémas', () => {
  it('téléphone : formats courants acceptés, texte refusé, null retire', () => {
    for (const telephone of [
      '06 12 34 56 78',
      '+33 6 12 34 56 78',
      '06.12.34.56.78',
      '0612345678',
    ]) {
      expect(ContactLocataireSchema.safeParse({ telephone }).success).toBe(true);
    }
    expect(ContactLocataireSchema.safeParse({ telephone: null }).success).toBe(true);
    expect(ContactLocataireSchema.safeParse({ telephone: 'appelez-moi' }).success).toBe(false);
    expect(ContactLocataireSchema.safeParse({ telephone: '12' }).success).toBe(false);
  });

  it('bailleur d’un bien, jeton, réponse, état', () => {
    expect(
      BailleurBienSchema.safeParse({ type: 'sci', nom: 'SCI Lices', adresse: '3 rue Paradis' })
        .success,
    ).toBe(true);
    expect(BailleurBienSchema.safeParse({ type: 'societe', nom: 'X', adresse: 'Y' }).success).toBe(
      false,
    );
    expect(JetonAccordSchema.safeParse('abcDEF_-12.1790000000.sig_nat-ure').success).toBe(true);
    expect(JetonAccordSchema.safeParse('abc.def.ghi<script>').success).toBe(false);
    expect(
      ReponseAccordSchema.safeParse({ jeton: 'abcDEF_-12.1790000000.sig', reponse: 'peut-etre' })
        .success,
    ).toBe(false);
    expect(
      EtatEnvoisSchema.safeParse({
        mode: 'journal',
        invitations: true,
        accords: [{ locataireId: 'julie', statut: 'non_demande' }],
        envois: [],
        contacts: [{ locataireId: 'julie', telephone: '0612345678' }],
        bailleursBiens: [{ bienId: 'b', type: 'personne', nom: 'Pierre', adresse: 'Marseille' }],
      }).success,
    ).toBe(true);
  });
});
