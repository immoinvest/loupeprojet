-- Gestion locative Deklic, B1 (gerer-bail-revision) : DPE et zone tendue d'un bien, réglages de révision d'une location, lettres de révision.
-- Écrite à la main. Appliquer depuis apps/comptes, après 0007 : `npx wrangler d1 migrations apply deklic-comptes --remote`.
-- Uniquement additive (ADR-G24) : aucune table existante ne change ; /api/gestion/etat et /export ne lisent pas ces tables.
-- Sans elle, seules les routes /api/gestion/bail répondent 503 BAIL_INDISPONIBLE ; le reste de Gérer marche.
-- Retour arrière : supprimer les trois tables.

create table "gestion_bien_legal" ("bienId" text not null primary key references "gestion_bien" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "dpeClasse" text, "dpeDate" text, "zoneTendue" integer, "modifieLe" text not null);

create index "gestion_bien_legal_userId_idx" on "gestion_bien_legal" ("userId");

create table "gestion_location_revision" ("locationId" text not null primary key references "gestion_location" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "active" integer not null, "anniversaire" text not null, "trimestre" text not null, "formeBail" text not null, "derniereRevision" text, "modifieLe" text not null);

create index "gestion_location_revision_userId_idx" on "gestion_location_revision" ("userId");

create table "gestion_bail_lettre" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "locationId" text not null references "gestion_location" ("id") on delete cascade, "cle" text not null, "numero" text not null, "anniversaire" text not null, "contenu" text not null, "emisLe" text not null, unique ("userId", "cle"));

create index "gestion_bail_lettre_locationId_idx" on "gestion_bail_lettre" ("locationId");
