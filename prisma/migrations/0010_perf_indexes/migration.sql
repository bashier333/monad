-- CreateIndex
CREATE INDEX "StagedRecord_organizationId_status_idx" ON "StagedRecord"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Correction_proposedById_idx" ON "Correction"("proposedById");

-- CreateIndex
CREATE INDEX "Notification_user_unread_idx" ON "Notification"("userId", "readAt");
