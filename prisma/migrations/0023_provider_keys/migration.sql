-- Bring-your-own AI provider keys (one row per org per provider).
CREATE TABLE IF NOT EXISTS "ProviderKey" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "encKey" TEXT NOT NULL,
  "keyHint" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderKey_organizationId_provider_key" ON "ProviderKey"("organizationId", "provider");
CREATE INDEX IF NOT EXISTS "ProviderKey_organizationId_idx" ON "ProviderKey"("organizationId");
ALTER TABLE "ProviderKey" DROP CONSTRAINT IF EXISTS "ProviderKey_organizationId_fkey";
ALTER TABLE "ProviderKey" ADD CONSTRAINT "ProviderKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
