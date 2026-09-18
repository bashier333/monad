-- CreateTable
CREATE TABLE "PlaceAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceAlias_organizationId_alias_key" ON "PlaceAlias"("organizationId", "alias");

-- CreateIndex
CREATE INDEX "PlaceAlias_organizationId_idx" ON "PlaceAlias"("organizationId");

-- AddForeignKey
ALTER TABLE "PlaceAlias" ADD CONSTRAINT "PlaceAlias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
