-- Backfill: the onto* tables lived in schema.prisma (via db push)
-- but never had a migration. This makes them exist on migrated databases.
-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoBranch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseVersions" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdById" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "plural" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OntoType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoProperty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "unique" BOOLEAN NOT NULL DEFAULT false,
    "indexed" BOOLEAN NOT NULL DEFAULT false,
    "immutable" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OntoProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fromTypeKey" TEXT NOT NULL,
    "toTypeKey" TEXT NOT NULL,
    "cardinality" TEXT NOT NULL,
    "inverseKey" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoTypeVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoTypeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoObject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OntoObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoEdge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "linkKey" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoFact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "txnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceRunId" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "OntoFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "objectId" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT NOT NULL DEFAULT '',
    "before" JSONB,
    "after" JSONB,
    "prevHash" TEXT NOT NULL DEFAULT '',
    "hash" TEXT NOT NULL DEFAULT '',
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetTypeKey" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "effects" JSONB NOT NULL,
    "approvalPolicy" TEXT NOT NULL DEFAULT 'none',
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OntoAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "inputs" JSONB,
    "requestedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvals" JSONB,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoWebhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" INTEGER,
    "lastAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoActionRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OntoPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "field" TEXT NOT NULL DEFAULT '',
    "op" TEXT NOT NULL DEFAULT 'eq',
    "value" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntoPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoBranch_organizationId_status_idx" ON "OntoBranch"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoBranch_organizationId_name_key" ON "OntoBranch"("organizationId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoType_organizationId_status_idx" ON "OntoType"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoType_organizationId_key_key" ON "OntoType"("organizationId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoProperty_organizationId_idx" ON "OntoProperty"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoProperty_typeId_key_key" ON "OntoProperty"("typeId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoLink_organizationId_idx" ON "OntoLink"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoLink_organizationId_key_key" ON "OntoLink"("organizationId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoTypeVersion_organizationId_idx" ON "OntoTypeVersion"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoTypeVersion_typeId_version_key" ON "OntoTypeVersion"("typeId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoObject_organizationId_typeKey_idx" ON "OntoObject"("organizationId", "typeKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoObject_organizationId_typeKey_key_key" ON "OntoObject"("organizationId", "typeKey", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoEdge_organizationId_fromId_idx" ON "OntoEdge"("organizationId", "fromId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoEdge_organizationId_toId_idx" ON "OntoEdge"("organizationId", "toId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoEdge_organizationId_linkKey_idx" ON "OntoEdge"("organizationId", "linkKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoEdge_fromId_linkKey_toId_key" ON "OntoEdge"("fromId", "linkKey", "toId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoAlias_organizationId_objectId_idx" ON "OntoAlias"("organizationId", "objectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoAlias_organizationId_alias_key" ON "OntoAlias"("organizationId", "alias");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoFact_organizationId_objectId_property_validFrom_idx" ON "OntoFact"("organizationId", "objectId", "property", "validFrom");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoFact_organizationId_objectId_txnAt_idx" ON "OntoFact"("organizationId", "objectId", "txnAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoEvent_organizationId_objectId_createdAt_idx" ON "OntoEvent"("organizationId", "objectId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoEvent_organizationId_kind_createdAt_idx" ON "OntoEvent"("organizationId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoAction_organizationId_idx" ON "OntoAction"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoAction_organizationId_key_key" ON "OntoAction"("organizationId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoApproval_organizationId_status_idx" ON "OntoApproval"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoApproval_organizationId_objectId_idx" ON "OntoApproval"("organizationId", "objectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoWebhook_organizationId_active_idx" ON "OntoWebhook"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoWebhook_organizationId_actionKey_key" ON "OntoWebhook"("organizationId", "actionKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoActionRun_organizationId_actionKey_idx" ON "OntoActionRun"("organizationId", "actionKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OntoActionRun_organizationId_idempotencyKey_key" ON "OntoActionRun"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OntoPolicy_organizationId_typeKey_active_idx" ON "OntoPolicy"("organizationId", "typeKey", "active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrgDeletion_orgId_key" ON "OrgDeletion"("orgId");

-- AddForeignKey
ALTER TABLE "OntoBranch" DROP CONSTRAINT IF EXISTS "OntoBranch_organizationId_fkey";
ALTER TABLE "OntoBranch" ADD CONSTRAINT "OntoBranch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoType" DROP CONSTRAINT IF EXISTS "OntoType_organizationId_fkey";
ALTER TABLE "OntoType" ADD CONSTRAINT "OntoType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoProperty" DROP CONSTRAINT IF EXISTS "OntoProperty_typeId_fkey";
ALTER TABLE "OntoProperty" ADD CONSTRAINT "OntoProperty_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "OntoType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoLink" DROP CONSTRAINT IF EXISTS "OntoLink_organizationId_fkey";
ALTER TABLE "OntoLink" ADD CONSTRAINT "OntoLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoTypeVersion" DROP CONSTRAINT IF EXISTS "OntoTypeVersion_organizationId_fkey";
ALTER TABLE "OntoTypeVersion" ADD CONSTRAINT "OntoTypeVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoTypeVersion" DROP CONSTRAINT IF EXISTS "OntoTypeVersion_typeId_fkey";
ALTER TABLE "OntoTypeVersion" ADD CONSTRAINT "OntoTypeVersion_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "OntoType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoObject" DROP CONSTRAINT IF EXISTS "OntoObject_organizationId_fkey";
ALTER TABLE "OntoObject" ADD CONSTRAINT "OntoObject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoEdge" DROP CONSTRAINT IF EXISTS "OntoEdge_organizationId_fkey";
ALTER TABLE "OntoEdge" ADD CONSTRAINT "OntoEdge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoAlias" DROP CONSTRAINT IF EXISTS "OntoAlias_organizationId_fkey";
ALTER TABLE "OntoAlias" ADD CONSTRAINT "OntoAlias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoFact" DROP CONSTRAINT IF EXISTS "OntoFact_organizationId_fkey";
ALTER TABLE "OntoFact" ADD CONSTRAINT "OntoFact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoEvent" DROP CONSTRAINT IF EXISTS "OntoEvent_organizationId_fkey";
ALTER TABLE "OntoEvent" ADD CONSTRAINT "OntoEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoAction" DROP CONSTRAINT IF EXISTS "OntoAction_organizationId_fkey";
ALTER TABLE "OntoAction" ADD CONSTRAINT "OntoAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoApproval" DROP CONSTRAINT IF EXISTS "OntoApproval_organizationId_fkey";
ALTER TABLE "OntoApproval" ADD CONSTRAINT "OntoApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoWebhook" DROP CONSTRAINT IF EXISTS "OntoWebhook_organizationId_fkey";
ALTER TABLE "OntoWebhook" ADD CONSTRAINT "OntoWebhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoActionRun" DROP CONSTRAINT IF EXISTS "OntoActionRun_organizationId_fkey";
ALTER TABLE "OntoActionRun" ADD CONSTRAINT "OntoActionRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntoPolicy" DROP CONSTRAINT IF EXISTS "OntoPolicy_organizationId_fkey";
ALTER TABLE "OntoPolicy" ADD CONSTRAINT "OntoPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Notification_user_unread_idx" RENAME TO "Notification_userId_readAt_idx";

