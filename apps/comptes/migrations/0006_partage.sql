-- Liens de partage courts Deklic (ADR-009) : une copie du projet enregistré, sans la visite, par lien.
-- Écrite à la main (Better Auth ne la génère pas). Aucune identité : ni compte, ni e-mail.
-- expireLe = 90 jours après la dernière ouverture ; jetonHash = SHA-256 du jeton de suppression ;
-- ipHash = empreinte salée de l'adresse IP (limite de 10 créations par heure), effacée après une heure.
-- Appliquer depuis apps/comptes : `npx wrangler d1 migrations apply deklic-comptes --remote` (--local en dev).
-- Retour arrière : supprimer la table partage (aucune autre table n'est modifiée).

create table "partage" ("id" text not null primary key, "contenu" text not null, "creeLe" text not null, "expireLe" text not null, "jetonHash" text not null, "ipHash" text);

create index "partage_expireLe_idx" on "partage" ("expireLe");

create index "partage_ipHash_creeLe_idx" on "partage" ("ipHash", "creeLe");
