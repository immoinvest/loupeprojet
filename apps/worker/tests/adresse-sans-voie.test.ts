import { describe, expect, it } from 'vitest';

import { lecteurMemoire } from '../src/donnees/lecteur';
import { banc, reponseJson } from './aide';

const CSV =
  'date,prix,surface,type,pieces,lat,lon,idParcelle,numero,suffixe,codeVoie,voie,carrez\n' +
  '2025-03-01,240000,60,appartement,3,43.294813,5.393807,132058200E0318,144,,6659,RUE DE L OLIVIER,58.5\n';

interface Reponse {
  parcelle: string | null;
  cadastre: string;
  groupes: { code: string; ventes: number }[];
}

describe('GET /marche/adresse sans numéro ni code de voie', () => {
  it('analyse par cercles seulement quand l’adresse et le cadastre ne situent pas l’immeuble', async () => {
    const { requete } = banc({
      fetcher: () => Promise.resolve(reponseJson({ features: [] })),
      donnees: lecteurMemoire({ 'dvf/2025/13205.csv': CSV }),
    });
    const r = await requete(
      '/marche/adresse?codeInsee=13205&lat=43.294813&lon=5.393807&surface=60',
    );
    expect(r.status).toBe(200);
    const corps = await r.json<Reponse>();
    expect(corps.parcelle).toBeNull();
    expect(corps.cadastre).toBe('ok');
    const ventes = Object.fromEntries(corps.groupes.map((g) => [g.code, g.ventes]));
    expect(ventes).toMatchObject({ meme_parcelle: 0, meme_cote: 0, en_face: 0, rayon_100: 1 });
  });
});
