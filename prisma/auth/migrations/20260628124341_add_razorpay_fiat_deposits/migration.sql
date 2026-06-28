-- CreateEnum
CREATE TYPE "FiatDepositProvider" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "FiatDepositStatus" AS ENUM ('CREATED', 'PAYMENT_CAPTURED', 'CREDITED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "FiatDeposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditedAssetId" TEXT NOT NULL,
    "provider" "FiatDepositProvider" NOT NULL,
    "status" "FiatDepositStatus" NOT NULL DEFAULT 'CREATED',
    "providerOrderId" VARCHAR(255) NOT NULL,
    "providerPaymentId" VARCHAR(255),
    "providerSignature" TEXT,
    "fiatCurrency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "fiatAmountMinor" BIGINT NOT NULL,
    "fiatAmount" DECIMAL(18,2) NOT NULL,
    "creditedAmount" DECIMAL(36,18) NOT NULL,
    "exchangeRate" DECIMAL(36,18) NOT NULL,
    "failureReason" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiatDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiatDeposit_providerOrderId_key" ON "FiatDeposit"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "FiatDeposit_providerPaymentId_key" ON "FiatDeposit"("providerPaymentId");

-- CreateIndex
CREATE INDEX "FiatDeposit_userId_status_idx" ON "FiatDeposit"("userId", "status");

-- CreateIndex
CREATE INDEX "FiatDeposit_provider_status_idx" ON "FiatDeposit"("provider", "status");

-- CreateIndex
CREATE INDEX "FiatDeposit_creditedAssetId_idx" ON "FiatDeposit"("creditedAssetId");

-- CreateIndex
CREATE INDEX "FiatDeposit_providerPaymentId_idx" ON "FiatDeposit"("providerPaymentId");

-- CreateIndex
CREATE INDEX "FiatDeposit_createdAt_idx" ON "FiatDeposit"("createdAt");

-- AddForeignKey
ALTER TABLE "FiatDeposit" ADD CONSTRAINT "FiatDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiatDeposit" ADD CONSTRAINT "FiatDeposit_creditedAssetId_fkey" FOREIGN KEY ("creditedAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
