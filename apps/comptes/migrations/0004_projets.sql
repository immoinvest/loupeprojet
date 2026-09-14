-- Projets d'analyse Deklic synchronisés avec le compte : un projet enregistré (JSON) par ligne, révision par compte.
-- Écrite à la main (Better Auth ne la génère pas). Supprimer un compte supprime ses projets en cascade.
-- Une suppression est une ligne sans contenu (supprime = 1), gardée 90 jours et 500 au plus par compte.
-- Numérotée 0004 : 0003 est prise par la migration des documents de gestion (branche quittances-fiches).
-- Appliquer depuis apps/comptes : `npx wrangler d1 migrations apply deklic-comptes --remote` (--local en dev).
-- Retour arrière : supprimer la table projet (aucune autre table n'est modifiée).

create table "projet" ("userId" text not null references "user" ("id") on delete cascade, "id" text not null, "contenu" text, "modifieLe" text not null, "revision" integer not null, "supprime" integer not null, primary key ("userId", "id"));

create index "projet_userId_revision_idx" on "projet" ("userId", "revision");
