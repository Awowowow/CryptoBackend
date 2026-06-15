-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "providerPendingApprovalId" VARCHAR(255),
ADD COLUMN     "providerState" VARCHAR(80),
ADD COLUMN     "providerTxRequestId" VARCHAR(255);

-- CreateIndex
CREATE INDEX "Withdrawal_providerTxRequestId_idx" ON "Withdrawal"("providerTxRequestId");

-- CreateIndex
CREATE INDEX "Withdrawal_providerPendingApprovalId_idx" ON "Withdrawal"("providerPendingApprovalId");
