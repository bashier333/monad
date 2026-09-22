-- Board persistence: versioned movable-board definitions with draft/publish
-- lifecycle and revocable share tokens. Layout diffs ride on snapshots.
CREATE TABLE "Board" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'My board',
  "layout" JSONB NOT NULL,
  "widgets" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "shareToken" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Board_shareToken_key" ON "Board"("shareToken");
CREATE INDEX "Board_organizationId_ownerId_updatedAt_idx" ON "Board"("organizationId", "ownerId", "updatedAt");
CREATE INDEX "Board_organizationId_updatedAt_idx" ON "Board"("organizationId", "updatedAt");
ALTER TABLE "Board" ADD CONSTRAINT "Board_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BoardVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BoardVersion_boardId_version_key" ON "BoardVersion"("boardId", "version");
CREATE INDEX "BoardVersion_organizationId_idx" ON "BoardVersion"("organizationId");
ALTER TABLE "BoardVersion" ADD CONSTRAINT "BoardVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardVersion" ADD CONSTRAINT "BoardVersion_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
