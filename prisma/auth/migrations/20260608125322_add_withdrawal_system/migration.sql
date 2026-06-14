-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'SECURITY_CHECKED', 'FUNDS_LOCKED', 'PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'SUBMITTED', 'BROADCASTED', 'CONFIRMED', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WithdrawalAddressStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'REJECTED');

-- CreateTable
CREATE TABLE "WithdrawalAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetNetworkId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "label" VARCHAR(120),
    "address" VARCHAR(255) NOT NULL,
    "memo" VARCHAR(255),
    "status" "WithdrawalAddressStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetNetworkId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "withdrawalAddressId" TEXT,
    "destinationAddress" VARCHAR(255) NOT NULL,
    "destinationMemo" VARCHAR(255),
    "amount" DECIMAL(36,18) NOT NULL,
    "feeAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(36,18) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "requiredConfirmations" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "provider" "CustodyProviderType" NOT NULL DEFAULT 'BITGO',
    "providerTransferId" VARCHAR(255),
    "txHash" VARCHAR(255),
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskReason" TEXT,
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "rejectionReason" TEXT,
    "cancelledReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "securityCheckedAt" TIMESTAMP(3),
    "fundsLockedAt" TIMESTAMP(3),
    "reviewRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "broadcastedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalAuditLog" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "fromStatus" "WithdrawalStatus",
    "toStatus" "WithdrawalStatus",
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WithdrawalAddress_userId_idx" ON "WithdrawalAddress"("userId");

-- CreateIndex
CREATE INDEX "WithdrawalAddress_assetNetworkId_idx" ON "WithdrawalAddress"("assetNetworkId");

-- CreateIndex
CREATE INDEX "WithdrawalAddress_networkId_idx" ON "WithdrawalAddress"("networkId");

-- CreateIndex
CREATE INDEX "WithdrawalAddress_status_idx" ON "WithdrawalAddress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalAddress_userId_assetNetworkId_address_memo_key" ON "WithdrawalAddress"("userId", "assetNetworkId", "address", "memo");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_idempotencyKey_key" ON "Withdrawal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- CreateIndex
CREATE INDEX "Withdrawal_assetId_idx" ON "Withdrawal"("assetId");

-- CreateIndex
CREATE INDEX "Withdrawal_assetNetworkId_idx" ON "Withdrawal"("assetNetworkId");

-- CreateIndex
CREATE INDEX "Withdrawal_networkId_idx" ON "Withdrawal"("networkId");

-- CreateIndex
CREATE INDEX "Withdrawal_withdrawalAddressId_idx" ON "Withdrawal"("withdrawalAddressId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

-- CreateIndex
CREATE INDEX "Withdrawal_txHash_idx" ON "Withdrawal"("txHash");

-- CreateIndex
CREATE INDEX "Withdrawal_requiresManualReview_status_idx" ON "Withdrawal"("requiresManualReview", "status");

-- CreateIndex
CREATE INDEX "Withdrawal_createdAt_idx" ON "Withdrawal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_provider_providerTransferId_key" ON "Withdrawal"("provider", "providerTransferId");

-- CreateIndex
CREATE INDEX "WithdrawalAuditLog_withdrawalId_idx" ON "WithdrawalAuditLog"("withdrawalId");

-- CreateIndex
CREATE INDEX "WithdrawalAuditLog_actorUserId_idx" ON "WithdrawalAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "WithdrawalAuditLog_toStatus_idx" ON "WithdrawalAuditLog"("toStatus");

-- CreateIndex
CREATE INDEX "WithdrawalAuditLog_createdAt_idx" ON "WithdrawalAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "WithdrawalAddress" ADD CONSTRAINT "WithdrawalAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalAddress" ADD CONSTRAINT "WithdrawalAddress_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalAddress" ADD CONSTRAINT "WithdrawalAddress_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "BlockchainNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "BlockchainNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_withdrawalAddressId_fkey" FOREIGN KEY ("withdrawalAddressId") REFERENCES "WithdrawalAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalAuditLog" ADD CONSTRAINT "WithdrawalAuditLog_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalAuditLog" ADD CONSTRAINT "WithdrawalAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
