-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'cost-line',
    "targetKey" TEXT NOT NULL,
    "field" TEXT NOT NULL DEFAULT '',
    "oldValue" TEXT NOT NULL DEFAULT '',
    "newValue" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "proposedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'reattribute',
    "costKind" TEXT NOT NULL DEFAULT '',
    "matchField" TEXT NOT NULL DEFAULT '',
    "matchValue" TEXT NOT NULL DEFAULT '',
    "toLoad" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Correction_organizationId_status_idx" ON "Correction"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Correction_organizationId_targetKey_idx" ON "Correction"("organizationId", "targetKey");

-- CreateIndex
CREATE INDEX "StandingRule_organizationId_active_idx" ON "StandingRule"("organizationId", "active");

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingRule" ADD CONSTRAINT "StandingRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
