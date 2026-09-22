-- Function registry: versioned deterministic logic (formula / aggregation /
-- composite / native-reference) that agents, boards and actions resolve
-- through one executor instead of hardcoded call sites.
CREATE TABLE "OntoFunction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "targetTypeKey" TEXT,
  "pure" BOOLEAN NOT NULL DEFAULT true,
  "budgetMs" INTEGER NOT NULL DEFAULT 5000,
  "kind" TEXT NOT NULL,
  "code" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastExecutedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OntoFunction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OntoFunction_organizationId_key_key" ON "OntoFunction"("organizationId", "key");
CREATE INDEX "OntoFunction_organizationId_enabled_idx" ON "OntoFunction"("organizationId", "enabled");
ALTER TABLE "OntoFunction" ADD CONSTRAINT "OntoFunction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OntoFunctionVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "functionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OntoFunctionVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OntoFunctionVersion_functionId_version_key" ON "OntoFunctionVersion"("functionId", "version");
ALTER TABLE "OntoFunctionVersion" ADD CONSTRAINT "OntoFunctionVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OntoFunctionVersion" ADD CONSTRAINT "OntoFunctionVersion_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "OntoFunction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
