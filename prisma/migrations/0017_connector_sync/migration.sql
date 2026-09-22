-- Connector sync ledger: every connector pull writes a SyncRun row;
-- per-org cursor + mapping + schedule live in ConnectorState.
CREATE TABLE "SyncRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "connectorKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "progress" INTEGER NOT NULL DEFAULT 100,
  "rowsPulled" INTEGER NOT NULL DEFAULT 0,
  "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
  "rowsQuarantined" INTEGER NOT NULL DEFAULT 0,
  "cursor" TEXT,
  "degraded" BOOLEAN NOT NULL DEFAULT false,
  "degradedSources" JSONB,
  "failureReason" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "triggeredById" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SyncRun_organizationId_connectorKey_startedAt_idx" ON "SyncRun"("organizationId", "connectorKey", "startedAt");
CREATE INDEX "SyncRun_organizationId_startedAt_idx" ON "SyncRun"("organizationId", "startedAt");
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ConnectorState" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "connectorKey" TEXT NOT NULL,
  "cursor" TEXT,
  "mapping" JSONB,
  "nextRunAt" TIMESTAMP(3),
  "lastPulledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectorState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConnectorState_organizationId_connectorKey_key" ON "ConnectorState"("organizationId", "connectorKey");
ALTER TABLE "ConnectorState" ADD CONSTRAINT "ConnectorState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
