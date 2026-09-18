-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "settings" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "emailedTo" JSONB,
    "feedback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brief_organizationId_weekStart_key" ON "Brief"("organizationId", "weekStart");

-- CreateIndex
CREATE INDEX "Brief_organizationId_idx" ON "Brief"("organizationId");

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
