-- AlterTable
ALTER TABLE "Brief" ADD COLUMN "pack" TEXT NOT NULL DEFAULT 'freight';

-- DropIndex
DROP INDEX "Brief_organizationId_weekStart_key";

-- CreateIndex
CREATE UNIQUE INDEX "Brief_organizationId_weekStart_pack_key" ON "Brief"("organizationId", "weekStart", "pack");
