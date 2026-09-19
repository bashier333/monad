-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "WorkflowPlaybook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
