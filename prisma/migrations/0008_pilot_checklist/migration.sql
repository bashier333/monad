-- CreateTable
CREATE TABLE "PilotChecklist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstAnswerAt" TIMESTAMP(3),
    "firstCorrectionAt" TIMESTAMP(3),
    "meetingConfirmedAt" TIMESTAMP(3),
    "meetingConfirmedBy" TEXT,
    "convertedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PilotChecklist_organizationId_key" ON "PilotChecklist"("organizationId");

-- AddForeignKey
ALTER TABLE "PilotChecklist" ADD CONSTRAINT "PilotChecklist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
