-- Gestion locative Deklic, G5-4 et G5-1 : dépenses et prêt d'un bien géré.
-- Écrite à la main. Appliquer depuis apps/comptes, après 0006 : `npx wrangler d1 migrations apply deklic-comptes --remote`.
-- Uniquement additive (ADR-G24, règle « migration sans risque ») : deux tables nouvelles, aucune table existante
-- modifiée ; seules les routes /argent, /depenses et /biens/:id/pret les lisent (503 DEPENSES_INDISPONIBLE sans elles).
-- Supprimer un compte ou un bien supprime ses dépenses et son prêt en cascade.
-- Retour arrière : supprimer gestion_depense et gestion_pret.

create table "gestion_depense" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "bienId" text references "gestion_bien" ("id") on delete cascade, "categorie" text not null, "montant" integer not null, "date" text not null, "libelle" text, "recuperable" integer not null, "frequence" text, "jusquAu" text, "creeLe" text not null, "modifieLe" text not null);

create table "gestion_pret" ("bienId" text not null primary key references "gestion_bien" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "capital" integer not null, "tauxAnnuel" real not null, "dureeMois" integer not null, "debut" text not null, "assuranceMensuelle" integer not null, "modifieLe" text not null);

create index "gestion_depense_userId_idx" on "gestion_depense" ("userId");

create index "gestion_depense_bienId_idx" on "gestion_depense" ("bienId");

create index "gestion_pret_userId_idx" on "gestion_pret" ("userId");
