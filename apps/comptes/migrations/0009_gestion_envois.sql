-- Gestion locative Deklic, G2 (quittances-auto) : accord du locataire, liens d'accord, quittances envoyées,
-- téléphone du locataire, identité de bailleur par bien.
-- Écrite à la main. Appliquer depuis apps/comptes : `npx wrangler d1 migrations apply deklic-comptes --remote`.
-- Uniquement additive (règle « migration sans risque ») : aucune table existante n'est modifiée, et le code
-- fonctionne sans elle (les routes /api/gestion/envois rendent 503 ENVOIS_INDISPONIBLE).
-- Retour arrière : supprimer les cinq tables ci-dessous.

create table "gestion_locataire_contact" ("locataireId" text not null primary key references "gestion_locataire" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "telephone" text not null, "modifieLe" text not null);

create index "gestion_locataire_contact_userId_idx" on "gestion_locataire_contact" ("userId");

create table "gestion_bien_bailleur" ("bienId" text not null primary key references "gestion_bien" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "type" text not null, "nom" text not null, "adresse" text not null, "modifieLe" text not null);

create index "gestion_bien_bailleur_userId_idx" on "gestion_bien_bailleur" ("userId");

-- L'accord s'applique à une adresse, gardée en empreinte SHA-256 seulement (ADR-G42).
create table "gestion_accord" ("locataireId" text not null primary key references "gestion_locataire" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "statut" text not null, "emailEmpreinte" text not null, "le" text, "invitationLe" text, "modifieLe" text not null);

create index "gestion_accord_userId_idx" on "gestion_accord" ("userId");

-- Un lien d'accord signé, à usage unique (ADR-G41).
create table "gestion_jeton" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "locataireId" text not null references "gestion_locataire" ("id") on delete cascade, "type" text not null, "emailEmpreinte" text not null, "expireLe" text not null, "utiliseLe" text, "creeLe" text not null);

create index "gestion_jeton_userId_idx" on "gestion_jeton" ("userId");

create index "gestion_jeton_locataireId_idx" on "gestion_jeton" ("locataireId");

-- Une trace par document et par locataire, destinataire masqué (ADR-G45).
create table "gestion_envoi" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "documentId" text not null references "gestion_document" ("id") on delete cascade, "locataireId" text not null references "gestion_locataire" ("id") on delete cascade, "destinataire" text not null, "statut" text not null, "tentatives" integer not null, "dernierEssaiLe" text not null, "envoyeLe" text, unique ("documentId", "locataireId"));

create index "gestion_envoi_userId_idx" on "gestion_envoi" ("userId");
