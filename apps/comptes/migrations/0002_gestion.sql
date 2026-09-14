-- Gestion locative Deklic : biens, locataires, locations, paiements et préférences du menu, par compte.
-- Écrite à la main (Better Auth ne la génère pas). Supprimer un compte supprime tout en cascade.
-- Appliquer depuis apps/comptes : `npx wrangler d1 migrations apply deklic-comptes --remote` (--local en dev).
-- Retour arrière : supprimer les cinq tables gestion_* (aucune table des comptes n'est modifiée).

create table "gestion_bien" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "nom" text not null, "adresse" text not null, "codePostal" text, "ville" text, "type" text not null, "surface" real, "meuble" integer not null, "projetId" text, "projet" text, "creeLe" text not null, "modifieLe" text not null);

create table "gestion_locataire" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "prenom" text not null, "nom" text not null, "email" text, "creeLe" text not null);

create table "gestion_location" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "bienId" text not null references "gestion_bien" ("id") on delete cascade, "locataireId" text not null references "gestion_locataire" ("id") on delete cascade, "type" text not null, "debut" text not null, "fin" text, "jourLoyer" integer not null, "loyerHorsCharges" integer not null, "charges" integer not null, "depot" integer not null, "creeLe" text not null);

create table "gestion_paiement" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "locationId" text not null references "gestion_location" ("id") on delete cascade, "periode" text not null, "montant" integer not null, "date" text not null, "source" text not null, "creeLe" text not null, unique ("locationId", "periode"));

create table "gestion_preference" ("userId" text not null primary key references "user" ("id") on delete cascade, "analyser" integer not null, "gerer" integer not null, "modifieLe" text not null);

create index "gestion_bien_userId_idx" on "gestion_bien" ("userId");

create index "gestion_locataire_userId_idx" on "gestion_locataire" ("userId");

create index "gestion_location_userId_idx" on "gestion_location" ("userId");

create index "gestion_location_bienId_idx" on "gestion_location" ("bienId");

create index "gestion_paiement_userId_idx" on "gestion_paiement" ("userId");
