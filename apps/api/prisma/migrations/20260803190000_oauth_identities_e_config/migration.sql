-- Login social passa de "uma coluna por provedor" (User.googleId) para uma tabela
-- de identidades, e as credenciais passam a ser editáveis pelo admin.

CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'APPLE');

CREATE TABLE "OAuthIdentity" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "provider"   "OAuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "email"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthIdentity_provider_providerId_key"
    ON "OAuthIdentity"("provider", "providerId");
CREATE INDEX "OAuthIdentity_userId_idx" ON "OAuthIdentity"("userId");

ALTER TABLE "OAuthIdentity" ADD CONSTRAINT "OAuthIdentity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserva os vínculos existentes do Google antes de remover a coluna.
INSERT INTO "OAuthIdentity" ("id", "userId", "provider", "providerId", "email")
SELECT gen_random_uuid(), "id", 'GOOGLE', "googleId", "email"
FROM "User"
WHERE "googleId" IS NOT NULL;

ALTER TABLE "User" DROP COLUMN "googleId";

CREATE TABLE "OAuthProviderConfig" (
    "provider"     "OAuthProvider" NOT NULL,
    "clientId"     TEXT,
    "clientSecret" TEXT,
    "enabled"      BOOLEAN NOT NULL DEFAULT false,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OAuthProviderConfig_pkey" PRIMARY KEY ("provider")
);
