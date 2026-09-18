-- CreateTable
CREATE TABLE "AnswerShare" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnswerShare_token_key" ON "AnswerShare"("token");

-- CreateIndex
CREATE INDEX "AnswerShare_organizationId_idx" ON "AnswerShare"("organizationId");

-- AddForeignKey
ALTER TABLE "AnswerShare" ADD CONSTRAINT "AnswerShare_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
