# 25 — Corriger les trois erreurs du moteur trouvées par l'audit

Statut : `livrée` (15/09/2026) · Notée le 15/09/2026 · Dépend de : 22 (audit, PR #79), 16 (impôt total, PR #83), 19 (travaux, PR #85) · Taille : une session, **trois PR successives**

Livraison : PR #92 (LMNP réel, ordre d'imputation), PR #93 (nu au réel, frais d'emprunt ; répare aussi les tests de bout en bout de la PR #92), PR #94 (plus-value, prix d'acquisition). Parcours `/bug-fix` (test rouge d'abord) : pas de discovery ni de specs séparées ; la règle, la source et l'avant / après chiffré sont dans chaque PR et dans le tableau de `.product/audit/calculs-2026-09.md` (lignes passées de 🟥 à ✅).

## Pourquoi

L'audit des calculs (fiche 22, `.product/audit/calculs-2026-09.md`) a confirmé trois erreurs du moteur contre des textes officiels (verdict 🟥).

## Les trois corrections

### 1. `fix/calcul-lmnp-ordre-imputation` — LMNP réel : ordre d'imputation (PR #92)

- **Avant** : les déficits antérieurs étaient imputés avant les amortissements.
- **Règle** : Conseil d'État, 15/04/2015 — un déficit ne s'impute que sur le bénéfice établi après tous les amortissements (CGI 39 C II ; CGI 156 I 1° ter : report 10 ans).
- **Effet** : impôt du projet 92K inchangé ; projet d'exemple T3 Marseille : amortissements du bâti déduits 2 116 € → 19 486 €, réintégrés à la revente (418 € d'impôt à 10 ans) ; un déficit peut expirer au bout de 10 ans (bien sans crédit loué 700 €, 25 ans : impôt 0 € → 5 324 €).

### 2. `fix/calcul-nu-reel-frais-emprunt` — location nue au réel : frais d'emprunt (PR #93)

- **Avant** : frais de dossier et de garantie non déduits ; assurance comptée dans les autres charges ; revenu brut compensé d'abord par les charges.
- **Règles** : BOI-RFPI-BASE-20-80 § 190 et 240 (frais d'emprunt déductibles l'année du paiement : année 1) ; BOI-RFPI-BASE-30-20 § 110 (le revenu brut compense prioritairement les intérêts ; frais de dossier et assurance assimilés aux intérêts).
- **Effet** : T3 Marseille en nu au réel : 7 556 € sur le revenu global l'année 1, impôt sur 10 ans 4 235 € → 4 426 €, imposé dès l'année 2.

### 3. `fix/calcul-plus-value-prix-acquisition` — plus-value : prix d'acquisition (PR #94)

- **Avant** : prix honoraires compris comme prix d'acquisition et base des forfaits 7,5 % et 15 %.
- **Règle** : BOI-RFPI-PVI-20-10-20-20 § 40 et 70 — prix stipulé dans l'acte ; commission due par l'acquéreur = frais d'acquisition ; forfaits sur le prix de l'acte.
- **Effet** : tous les régimes (`reventeDuRegime`) ; projet 92K : prix majoré 169 295 € → 167 945 € à 5 ans ; T3 Marseille à 10 ans : impôt de plus-value 418 € → 723 €. Le détail de la plus-value expose `prixAcquisition` (onglet Revente).

## Questions ouvertes : décisions prises

- Année de déduction des frais de dossier et de garantie (nu au réel) : année 1, année du paiement (BOI-RFPI-BASE-20-80 § 240), comme en LMNP réel.
- Frais bancaires sans crédit : lus dans l'hypothèse du prêt (`pret.fraisDossier + pret.fraisGarantie`), comme `fraisDeductiblesAnnee1` du LMNP réel.

## Hors périmètre

Les 12 recommandations de l'audit (dont la 9 : frais d'acquisition déduits au réel puis ajoutés au prix de la plus-value, à faire valider par un fiscaliste), l'interface (sauf textes qui décrivaient une règle fausse), le Worker, les données.
