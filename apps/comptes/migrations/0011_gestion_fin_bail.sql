-- Gestion locative Deklic, B2 (gerer-bail-fin) : congé et préavis, mode des charges, restitution du dépôt, régularisation des charges, changements de colocataire, décomptes figés.
-- Écrite à la main. Appliquer depuis apps/comptes, après 0010 : `npx wrangler d1 migrations apply deklic-comptes --remote`.
-- Uniquement additive (ADR-G34) : aucune table existante ne change ; /api/gestion/etat et /export ne lisent pas ces tables.
-- Sans elle, seules les routes /api/gestion/fin-bail répondent 503 FIN_BAIL_INDISPONIBLE ; les quittances nomment tous les locataires du bail, comme avant.
-- Supprimer un compte, un bien ou une location supprime ces lignes en cascade.
-- Retour arrière : supprimer les six tables.

create table "gestion_conge" ("locationId" text not null primary key references "gestion_location" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "recuLe" text not null, "fin" text not null, "reduit" integer not null, "modifieLe" text not null);

create index "gestion_conge_userId_idx" on "gestion_conge" ("userId");

create table "gestion_location_charges" ("locationId" text not null primary key references "gestion_location" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "mode" text not null, "modifieLe" text not null);

create index "gestion_location_charges_userId_idx" on "gestion_location_charges" ("userId");

create table "gestion_depot_restitution" ("locationId" text not null primary key references "gestion_location" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "clesLe" text not null, "conforme" integer not null, "retenues" text not null, "depot" integer not null, "aRendre" integer not null, "dateLimite" text not null, "decompteId" text not null, "rendueLe" text, "modifieLe" text not null);

create index "gestion_depot_restitution_userId_idx" on "gestion_depot_restitution" ("userId");

create table "gestion_regularisation" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "locationId" text not null references "gestion_location" ("id") on delete cascade, "annee" integer not null, "solde" integer not null, "aPartirDe" text not null, "decompteId" text not null, "regleeLe" text, "creeLe" text not null, unique ("locationId", "annee"));

create index "gestion_regularisation_userId_idx" on "gestion_regularisation" ("userId");

create table "gestion_colocation_mouvement" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "locationId" text not null references "gestion_location" ("id") on delete cascade, "locataireId" text not null references "gestion_locataire" ("id") on delete cascade, "sens" text not null, "date" text not null, "creeLe" text not null);

create index "gestion_colocation_mouvement_locationId_idx" on "gestion_colocation_mouvement" ("locationId");

create index "gestion_colocation_mouvement_userId_idx" on "gestion_colocation_mouvement" ("userId");

create table "gestion_decompte" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "locationId" text not null references "gestion_location" ("id") on delete cascade, "cle" text not null, "type" text not null, "numero" text not null, "contenu" text not null, "emisLe" text not null, unique ("userId", "cle"));

create index "gestion_decompte_locationId_idx" on "gestion_decompte" ("locationId");
