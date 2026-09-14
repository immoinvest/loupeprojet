-- Gestion locative Deklic, G1b : paiements partiels, identité du bailleur, quittances et reçus figés.
-- Écrite à la main. Appliquer depuis apps/comptes, après 0002 : `npx wrangler d1 migrations apply deklic-comptes --remote`.
-- gestion_paiement est recréée : SQLite ne sait pas retirer la contrainte unique (locationId, periode) de G1a.
-- Aucune table ne référence gestion_paiement ; ses lignes sont copiées à l'identique.
-- Retour arrière : supprimer gestion_document et gestion_bailleur ; les paiements restent lisibles par G1a.

create table "gestion_paiement_g1b" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "locationId" text not null references "gestion_location" ("id") on delete cascade, "periode" text not null, "montant" integer not null, "date" text not null, "source" text not null, "creeLe" text not null);

insert into "gestion_paiement_g1b" ("id", "userId", "locationId", "periode", "montant", "date", "source", "creeLe") select "id", "userId", "locationId", "periode", "montant", "date", "source", "creeLe" from "gestion_paiement";

drop table "gestion_paiement";

alter table "gestion_paiement_g1b" rename to "gestion_paiement";

create index "gestion_paiement_userId_idx" on "gestion_paiement" ("userId");

create index "gestion_paiement_location_periode_idx" on "gestion_paiement" ("locationId", "periode");

create table "gestion_bailleur" ("userId" text not null primary key references "user" ("id") on delete cascade, "nom" text not null, "adresse" text not null, "modifieLe" text not null);

create table "gestion_document" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "cle" text not null, "type" text not null, "numero" text not null, "locationId" text not null references "gestion_location" ("id") on delete cascade, "periode" text not null, "paiementId" text, "contenu" text not null, "emisLe" text not null, unique ("userId", "cle"));

create index "gestion_document_userId_idx" on "gestion_document" ("userId");
