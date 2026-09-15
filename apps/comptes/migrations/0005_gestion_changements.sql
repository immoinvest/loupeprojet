-- Gestion locative Deklic, G1c : montants d'une location modifiés à partir d'un mois, APL versée au bailleur.
-- Écrite à la main. Appliquer depuis apps/comptes, après 0004 : `npx wrangler d1 migrations apply deklic-comptes --remote`.
-- Aucune reprise de données : les montants d'entrée restent sur gestion_location (ADR-G14).
-- Sans risque pour le code de G1b : la colonne apl (0 par défaut) est ignorée, la nouvelle table n'est pas lue.
-- Retour arrière : supprimer gestion_changement ; la colonne apl peut rester.

alter table "gestion_location" add column "apl" integer not null default 0;

create table "gestion_changement" ("locationId" text not null references "gestion_location" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "aPartirDe" text not null, "loyerHorsCharges" integer not null, "charges" integer not null, "apl" integer not null, "modifieLe" text not null, primary key ("locationId", "aPartirDe"));

create index "gestion_changement_userId_idx" on "gestion_changement" ("userId");
