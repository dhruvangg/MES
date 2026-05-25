-- AlterTable
ALTER TABLE "DiscrepancyIssue" ADD COLUMN     "reworkTargetStepId" TEXT;

-- AddForeignKey
ALTER TABLE "DiscrepancyIssue" ADD CONSTRAINT "DiscrepancyIssue_reworkTargetStepId_fkey" FOREIGN KEY ("reworkTargetStepId") REFERENCES "RoutingStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
