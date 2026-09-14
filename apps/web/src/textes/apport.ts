import { PART_APPORT_DEFAUT, partDuCoutTotal } from '@/annonces/apport';
import { euros, pourcentage } from '@/formatage/nombres';

/**
 * La phrase sous le champ Apport : sa part du coût total quand on le connaît, sinon la règle du
 * défaut. « Soit 10 % du coût total du projet (124 000 €). »
 */
export function texteApport(apport: number | null, coutTotal: number | null): string {
  const part = apport === null ? null : partDuCoutTotal(apport, coutTotal);
  if (part === null || coutTotal === null) {
    return `Par défaut, ${pourcentage(PART_APPORT_DEFAUT, 0)} du coût total : prix, frais, travaux et mobilier.`;
  }
  return `Soit ${pourcentage(part, 0)} du coût total du projet (${euros(coutTotal)}).`;
}
