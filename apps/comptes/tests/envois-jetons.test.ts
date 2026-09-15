import { describe, expect, it } from 'vitest';

import { empreinteEmail, signatureJetons } from '../src/gestion/envois/jetons';
import { nouveauJeton } from '../src/partage/jetons';

const SECRET = 'secret-des-liens-d-accord-pour-les-tests-0123';
const MAINTENANT = Date.parse('2026-10-06T08:00:00.000Z');
const DANS_30_JOURS = MAINTENANT + 30 * 86_400_000;

describe('liens d’accord signés (ADR-G41)', () => {
  it('un jeton signé se vérifie et rend son identifiant', async () => {
    const signature = signatureJetons(SECRET);
    const id = nouveauJeton();
    const jeton = await signature.signer(id, DANS_30_JOURS);
    expect(jeton).toMatch(/^[A-Za-z0-9_-]{43}\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(await signature.verifier(jeton, MAINTENANT)).toBe(id);
  });

  it('refuse un jeton expiré, modifié, signé par un autre secret ou mal formé', async () => {
    const signature = signatureJetons(SECRET);
    const id = nouveauJeton();
    const jeton = await signature.signer(id, DANS_30_JOURS);
    const [identifiant = '', expiration = '', signe = ''] = jeton.split('.');

    expect(await signature.verifier(jeton, DANS_30_JOURS)).toBeNull();
    expect(
      await signature.verifier(
        `${identifiant}.${String(Number(expiration) + 86_400)}.${signe}`,
        MAINTENANT,
      ),
    ).toBeNull();
    const autreId = `${identifiant.slice(0, -1)}${identifiant.endsWith('A') ? 'B' : 'A'}`;
    expect(await signature.verifier(`${autreId}.${expiration}.${signe}`, MAINTENANT)).toBeNull();
    expect(await signatureJetons(`${SECRET}-autre`).verifier(jeton, MAINTENANT)).toBeNull();
    expect(await signature.verifier('pas-un-jeton', MAINTENANT)).toBeNull();
    expect(await signature.verifier(`${jeton}x`, MAINTENANT)).toBeNull();
  });

  it('l’empreinte d’une adresse ignore la casse et les espaces', async () => {
    const a = await empreinteEmail(' Julie@Exemple.fr ');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await empreinteEmail('julie@exemple.fr')).toBe(a);
    expect(await empreinteEmail('lea@exemple.fr')).not.toBe(a);
  });
});
