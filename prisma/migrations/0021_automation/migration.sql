-- Unified automations: versioned trigger+effect definitions with guards.
-- Run history rides on EventLog (type automation.*); no extra table.
CREATE TABLE "Automation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" JSONB NOT NULL,
  "effects" JSONB NOT NULL,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "backoff" TEXT NOT NULL DEFAULT 'exponential',
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "mutedUntilMs" BIGINT,
  "expiresAtMs" BIGINT,
  "throttlePerHour" INTEGER,
  "dependsOn" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastFiredAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Automation_organizationId_key_key" ON "Automation"("organizationId", "key");
CREATE INDEX "Automation_organizationId_enabled_idx" ON "Automation"("organizationId", "enabled");
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
